import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { addItemToWatchlist, getWatchlistWithItems } from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/watchlists/[id]/items
 * Get all items in a watchlist with optional filtering
 *
 * Supports both session cookie auth (web app) and MediaBrowser token (external API).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { session } = auth;
  const { id } = await params;

  const watchlistId = parseInt(id, 10);
  if (Number.isNaN(watchlistId)) {
    return jsonResponse({ error: "Invalid watchlist ID" }, 400);
  }

  const searchParams = request.nextUrl.searchParams;
  const typeFilter = searchParams.get("type") ?? undefined;
  const sortOrder = (searchParams.get("sort") as any) ?? undefined;

  const watchlist = await getWatchlistWithItems({
    watchlistId,
    userId: session.id,
    typeFilter,
    sortOrder,
  });

  if (!watchlist) {
    return jsonResponse({ error: "Watchlist not found" }, 404);
  }

  return jsonResponse({ data: watchlist });
}

/**
 * POST /api/watchlists/[id]/items
 * Add an item to a watchlist
 *
 * Supports both session cookie auth (web app) and MediaBrowser token (external API).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(request);
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

  const { itemId } = body as Record<string, unknown>;

  if (typeof itemId !== "string" || itemId.trim() === "") {
    return jsonResponse({ error: "itemId is required" }, 400);
  }

  const result = await addItemToWatchlist({
    watchlistId,
    itemId: itemId.trim(),
    userId: session.id,
  });

  if (!result) {
    return jsonResponse(
      {
        error:
          "Failed to add item. Watchlist not found, item type not allowed, or item already exists.",
      },
      400,
    );
  }

  return jsonResponse({ data: result }, 201);
}
