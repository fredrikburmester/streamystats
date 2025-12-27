import type { NextRequest } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { createWatchlist, getWatchlistsForUser } from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/watchlists
 * List all watchlists for the current user (own + public)
 */
export async function GET() {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { session } = auth;

  const watchlists = await getWatchlistsForUser({
    serverId: session.serverId,
    userId: session.id,
  });

  return jsonResponse({ data: watchlists });
}

/**
 * POST /api/watchlists
 * Create a new watchlist
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  const { session } = auth;

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

  if (typeof name !== "string" || name.trim() === "") {
    return jsonResponse({ error: "Name is required" }, 400);
  }

  if (
    defaultSortOrder !== undefined &&
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

  const watchlist = await createWatchlist({
    serverId: session.serverId,
    userId: session.id,
    name: name.trim(),
    description: typeof description === "string" ? description : null,
    isPublic: typeof isPublic === "boolean" ? isPublic : false,
    allowedItemType:
      typeof allowedItemType === "string" ? allowedItemType : null,
    defaultSortOrder:
      typeof defaultSortOrder === "string" ? defaultSortOrder : "custom",
  });

  return jsonResponse({ data: watchlist }, 201);
}
