import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { removeItemFromWatchlist } from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * DELETE /api/watchlists/[id]/items/[itemId]
 * Remove an item from a watchlist
 *
 * Supports both session cookie auth (web app) and MediaBrowser token (external API).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { session } = auth;
  const { id, itemId } = await params;

  const watchlistId = parseInt(id, 10);
  if (Number.isNaN(watchlistId)) {
    return jsonResponse({ error: "Invalid watchlist ID" }, 400);
  }

  const deleted = await removeItemFromWatchlist({
    watchlistId,
    itemId,
    userId: session.id,
  });

  if (!deleted) {
    return jsonResponse(
      { error: "Item not found in watchlist or access denied" },
      404,
    );
  }

  return jsonResponse({ success: true });
}
