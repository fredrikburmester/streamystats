import { db, items } from "@streamystats/database";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    const { error, session } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { itemIds } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "itemIds array is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const foundItems = await db
      .select()
      .from(items)
      .where(
        and(
          inArray(items.id, itemIds),
          eq(items.serverId, session.serverId),
          isNull(items.deletedAt),
        ),
      );

    const itemsMap = new Map(foundItems.map((item) => [item.id, item]));

    const result = itemIds.map((id: string) => ({
      id,
      item: itemsMap.get(id) || null,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        items: result,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching item preview:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch items",
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
