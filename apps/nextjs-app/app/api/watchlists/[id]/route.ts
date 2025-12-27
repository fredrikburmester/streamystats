import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  deleteWatchlist,
  getWatchlistById,
  updateWatchlist,
} from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/watchlists/[id]
 * Get a single watchlist by ID
 */
export async function GET(
  _request: NextRequest,
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

  const watchlist = await getWatchlistById({
    watchlistId,
    userId: session.id,
  });

  if (!watchlist) {
    return jsonResponse({ error: "Watchlist not found" }, 404);
  }

  return jsonResponse({ data: watchlist });
}

/**
 * PATCH /api/watchlists/[id]
 * Update a watchlist
 */
export async function PATCH(
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

  const { name, description, isPublic, allowedItemType, defaultSortOrder } =
    body as Record<string, unknown>;

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
  _request: NextRequest,
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

  const deleted = await deleteWatchlist({
    watchlistId,
    userId: session.id,
  });

  if (!deleted) {
    return jsonResponse({ error: "Watchlist not found or access denied" }, 404);
  }

  return jsonResponse({ success: true });
}
