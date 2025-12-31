import type { NextRequest } from "next/server";
import {
  authenticateMediaBrowser,
  validateJellyfinToken,
} from "@/lib/api-auth";
import {
  hasServerIdentifier,
  parseServerIdentifier,
  resolveServer,
} from "@/lib/db/server-resolver";
import {
  getPromotedWatchlists,
  getWatchlistPreviewItems,
  type WatchlistWithItemCountSanitized,
} from "@/lib/db/watchlists";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * IDs-only response format
 */
export type PromotedWatchlistIdsResponse = {
  watchlists: string[];
  total: number;
};

export type PromotedWatchlistFullItem = WatchlistWithItemCountSanitized & {
  previewItems: Array<{
    id: string;
    name: string | null;
    type: string | null;
    primaryImageTag: string | null;
  }>;
};

/**
 * GET /api/watchlists/promoted
 * Get promoted watchlists for a server
 * Supports external authentication via MediaBrowser token
 *
 * Server identification (use one):
 * - serverId: Internal Streamystats server ID
 * - serverName: Server name (exact match, case-insensitive)
 * - serverUrl: Server URL (partial match)
 * - jellyfinServerId: Jellyfin's unique server ID
 *
 * Other params:
 * - format: Response format - "full" (default) or "ids"
 * - limit: Max results (default: 20, max: 100)
 * - includePreview: Include preview items for each watchlist (default: true)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const serverIdentifier = parseServerIdentifier(searchParams);

  if (!hasServerIdentifier(serverIdentifier)) {
    return jsonResponse(
      {
        error:
          "Server identifier required. Use one of: serverId, serverName, serverUrl, or jellyfinServerId",
      },
      400,
    );
  }

  const server = await resolveServer(serverIdentifier);

  if (!server) {
    return jsonResponse({ error: "Server not found" }, 404);
  }

  // Authenticate via MediaBrowser token
  const mediaBrowserAuth = await authenticateMediaBrowser(request);
  if (!mediaBrowserAuth) {
    return jsonResponse(
      {
        error: "Unauthorized",
        message:
          'Valid Jellyfin token required. Use Authorization: MediaBrowser Token="..." header.',
      },
      401,
    );
  }

  // Verify the authenticated server matches the requested server
  if (mediaBrowserAuth.server.id !== server.id) {
    const authHeader = request.headers.get("authorization");
    const tokenMatch = authHeader?.match(/Token="([^"]*)"/i);
    const token = tokenMatch?.[1];

    if (token) {
      const userInfo = await validateJellyfinToken(server.url, token);
      if (!userInfo) {
        return jsonResponse(
          {
            error: "Unauthorized",
            message: "Token is not valid for the requested server.",
          },
          401,
        );
      }
    } else {
      return jsonResponse(
        {
          error: "Unauthorized",
          message: "Token is not valid for the requested server.",
        },
        401,
      );
    }
  }

  const format = searchParams.get("format") || "full";
  const limitRaw = searchParams.get("limit");
  const limit = Math.min(
    100,
    Math.max(1, parseInt(limitRaw ?? "20", 10) || 20),
  );
  const includePreview = searchParams.get("includePreview") !== "false";

  const watchlists = await getPromotedWatchlists({ serverId: server.id });
  const limitedWatchlists = watchlists.slice(0, limit);

  // Return IDs-only format
  if (format === "ids") {
    const idsResponse: PromotedWatchlistIdsResponse = {
      watchlists: limitedWatchlists.map((w) => String(w.id)),
      total: limitedWatchlists.length,
    };
    return jsonResponse({ data: idsResponse });
  }

  // Full format with optional preview items
  if (includePreview) {
    const watchlistsWithPreview: PromotedWatchlistFullItem[] =
      await Promise.all(
        limitedWatchlists.map(async (w) => {
          const previewItems = await getWatchlistPreviewItems({
            watchlistId: w.id,
          });
          return {
            ...w,
            previewItems: previewItems.map((item) => ({
              id: item.id,
              name: item.name,
              type: item.type,
              primaryImageTag: item.primaryImageTag,
            })),
          };
        }),
      );

    return jsonResponse({
      server: { id: server.id, name: server.name },
      data: watchlistsWithPreview,
      total: watchlistsWithPreview.length,
    });
  }

  return jsonResponse({
    server: { id: server.id, name: server.name },
    data: limitedWatchlists,
    total: limitedWatchlists.length,
  });
}
