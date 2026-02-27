import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  deleteWatchlist,
  getWatchlistWithItemsLite,
  updateWatchlist,
  updateWatchlistAsAdmin,
} from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/watchlists/[id]
 * Get a single watchlist by ID with items
 *
 * Supports both session cookie auth (web app) and MediaBrowser token (external API).
 * Returns watchlist if user owns it or it's public.
 *
 * Query params:
 * - format: "full" (default) or "ids" - IDs format returns only item IDs
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

  const format = request.nextUrl.searchParams.get("format") || "full";

  const watchlist = await getWatchlistWithItemsLite({
    watchlistId,
    userId: session.id,
  });

  if (!watchlist) {
    return jsonResponse({ error: "Watchlist not found" }, 404);
  }

  // Return IDs-only format
  if (format === "ids") {
    return jsonResponse({
      data: {
        id: watchlist.id,
        name: watchlist.name,
        items: watchlist.items.map((i) => i.itemId),
      },
    });
  }

  return jsonResponse({ data: watchlist });
}

/**
 * PATCH /api/watchlists/[id]
 * Update a watchlist
 * Admin-only: isPromoted field
 */
export async function PATCH(
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

  const {
    name,
    description,
    isPublic,
    isPromoted,
    allowedItemType,
    defaultSortOrder,
  } = body as Record<string, unknown>;

  // Handle admin-only isPromoted field
  if (isPromoted !== undefined) {
    if (!session.isAdmin) {
      return jsonResponse(
        { error: "Only admins can set the isPromoted flag" },
        403,
      );
    }
    if (typeof isPromoted !== "boolean") {
      return jsonResponse({ error: "isPromoted must be a boolean" }, 400);
    }

    const updated = await updateWatchlistAsAdmin({
      watchlistId,
      serverId: session.serverId,
      data: { isPromoted },
    });

    if (!updated) {
      return jsonResponse({ error: "Watchlist not found" }, 404);
    }

    // If only isPromoted was passed, return early
    const otherFields = {
      name,
      description,
      isPublic,
      allowedItemType,
      defaultSortOrder,
    };
    const hasOtherFields = Object.values(otherFields).some(
      (v) => v !== undefined,
    );
    if (!hasOtherFields) {
      return jsonResponse({ data: updated });
    }
  }

  const updateData: Record<string, unknown> = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim() === "") {
      return jsonResponse({ error: "Name cannot be empty" }, 400);
    }
    updateData.name = name.trim();
  }

  if (description !== undefined) {
    updateData.description =
      typeof description === "string" ? description : null;
  }

  if (isPublic !== undefined) {
    if (typeof isPublic !== "boolean") {
      return jsonResponse({ error: "isPublic must be a boolean" }, 400);
    }
    updateData.isPublic = isPublic;
  }

  if (allowedItemType !== undefined) {
    updateData.allowedItemType =
      typeof allowedItemType === "string" ? allowedItemType : null;
  }

  if (defaultSortOrder !== undefined) {
    if (
      !["custom", "name", "dateAdded", "releaseDate"].includes(
        defaultSortOrder as string,
      )
    ) {
      return jsonResponse(
        {
          error:
            "Invalid defaultSortOrder. Must be custom, name, dateAdded, or releaseDate",
        },
        400,
      );
    }
    updateData.defaultSortOrder = defaultSortOrder;
  }

  if (Object.keys(updateData).length === 0) {
    return jsonResponse({ error: "No valid fields to update" }, 400);
  }

  const updated = await updateWatchlist({
    watchlistId,
    userId: session.id,
    data: updateData as any,
  });

  if (!updated) {
    return jsonResponse({ error: "Watchlist not found or access denied" }, 404);
  }

  return jsonResponse({ data: updated });
}

/**
 * DELETE /api/watchlists/[id]
 * Delete a watchlist
 */
export async function DELETE(
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

  const deleted = await deleteWatchlist({
    watchlistId,
    userId: session.id,
  });

  if (!deleted) {
    return jsonResponse({ error: "Watchlist not found or access denied" }, 404);
  }

  return jsonResponse({ success: true });
}
