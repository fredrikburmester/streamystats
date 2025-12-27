import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { reorderWatchlistItems } from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/watchlists/[id]/items/reorder
 * Reorder items in a watchlist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { session } = auth;
  const { id } = await params;

  const watchlistId = parseInt(id, 10);
  if (Number.isNaN(watchlistId)) {
    return jsonResponse({ error: "Invalid watchlist ID" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ error: "Request body must be an object" }, 400);
  }

  const { itemIds } = body as Record<string, unknown>;

  if (
    !Array.isArray(itemIds) ||
    !itemIds.every((id) => typeof id === "string")
  ) {
    return jsonResponse({ error: "itemIds must be an array of strings" }, 400);
  }

  const success = await reorderWatchlistItems({
    watchlistId,
    userId: session.id,
    itemIds,
  });

  if (!success) {
    return jsonResponse({ error: "Watchlist not found or access denied" }, 404);
  }

  return jsonResponse({ success: true });
}
