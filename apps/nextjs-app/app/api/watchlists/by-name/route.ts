import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getWatchlistByName } from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/watchlists/by-name
 * Get a watchlist by name for a specific user
 * Query params: userId, name
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { session } = auth;
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");
  const name = searchParams.get("name");

  if (!userId) {
    return jsonResponse({ error: "userId is required" }, 400);
  }

  if (!name) {
    return jsonResponse({ error: "name is required" }, 400);
  }

  const watchlist = await getWatchlistByName({
    serverId: session.serverId,
    userId,
    name,
    requestingUserId: session.id,
  });

  if (!watchlist) {
    return jsonResponse({ error: "Watchlist not found" }, 404);
  }

  return jsonResponse({ data: watchlist });
}
