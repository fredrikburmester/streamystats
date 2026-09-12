import { db, items } from "@streamystats/database";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

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

    const { error } = await requireAdmin(serverIdNum);
    if (error) return error;

    // Find orphaned seasons: deleted seasons with no episodes
    const orphanedSeasons = await db
      .select({
        id: items.id,
        name: items.name,
        seriesName: items.seriesName,
        indexNumber: items.indexNumber,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, "Season"),
          isNotNull(items.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM items e 
            WHERE e.season_id = ${items.id}
          )`,
        ),
      );

    // Find orphaned series: deleted series with no seasons or episodes
    const orphanedSeries = await db
      .select({
        id: items.id,
        name: items.name,
        productionYear: items.productionYear,
      })
      .from(items)
      .where(
        and(
          eq(items.serverId, serverIdNum),
          eq(items.type, "Series"),
          isNotNull(items.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM items e 
            WHERE e.series_id = ${items.id}
          )`,
        ),
      );

    return new Response(
      JSON.stringify({
        success: true,
        orphanedSeasons: orphanedSeasons.map((s) => ({
          id: s.id,
          name: s.name,
          seriesName: s.seriesName,
          seasonNumber: s.indexNumber,
        })),
        orphanedSeries: orphanedSeries.map((s) => ({
          id: s.id,
          name: s.name,
          productionYear: s.productionYear,
        })),
        summary: {
          orphanedSeasonsCount: orphanedSeasons.length,
          orphanedSeriesCount: orphanedSeries.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error finding orphaned series:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to find orphaned series",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
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

    // Delete orphaned seasons first (they reference series)
    const deletedSeasons = await db
      .delete(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.type, "Season"),
          isNotNull(items.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM items e 
            WHERE e.season_id = ${items.id}
          )`,
        ),
      )
      .returning({ id: items.id, name: items.name });

    // Then delete orphaned series
    const deletedSeries = await db
      .delete(items)
      .where(
        and(
          eq(items.serverId, serverId),
          eq(items.type, "Series"),
          isNotNull(items.deletedAt),
          sql`NOT EXISTS (
            SELECT 1 FROM items e 
            WHERE e.series_id = ${items.id}
          )`,
        ),
      )
      .returning({ id: items.id, name: items.name });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleaned up ${deletedSeasons.length} orphaned seasons and ${deletedSeries.length} orphaned series`,
        metrics: {
          seasonsDeleted: deletedSeasons.length,
          seriesDeleted: deletedSeries.length,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error cleaning up orphaned series:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to cleanup orphaned series",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
