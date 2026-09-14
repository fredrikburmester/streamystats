import type { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { getItemDetails } from "@/lib/db/items";
import { getServerWithSecrets } from "@/lib/db/server";

/**
 * API Route: GET /api/get-item-details/[itemId]?serverId=123
 *
 * Returns detailed statistics and metadata for a given item.
 * Requires valid API key in Authorization header that matches the target server.
 *
 * Path Params:
 *   - itemId: string (required) - The ID of the item to fetch details for.
 *
 * Query Params:
 *   - serverId: string (required) - The ID of the server to validate against.
 *
 * Headers:
 *   - Authorization: string (required) - API key in format "Bearer <key>" or just "<key>"
 *
 * Responses:
 *   - 200: Returns the item details as JSON.
 *   - 400: If itemId or serverId is missing.
 *   - 401: If API key is invalid or missing.
 *   - 404: If the item is not found.
 *   - 500: On server error.
 */

/**
 * Handles GET requests for fetching item details.
 *
 * @param request - The Next.js request object.
 * @param params - An object containing the itemId parameter.
 * @returns A Response object with item details or error information.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("serverId");

  try {
    // Validate required parameters
    if (!itemId) {
      return new Response(
        JSON.stringify({
          error: "itemId is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (!serverId) {
      return new Response(
        JSON.stringify({
          error: "serverId query parameter is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const server = await getServerWithSecrets({ serverId });

    if (!server) {
      return new Response(
        JSON.stringify({
          error: "Server not found",
        }),
      );
    }

    // Validate API key against the specified server
    const authError = await requireApiKey({
      request,
      server,
    });

    if (authError) {
      return authError;
    }

    // Get item details
    const itemDetails = await getItemDetails({
      serverId: server.id,
      itemId,
    });

    if (!itemDetails) {
      return new Response(
        JSON.stringify({
          error: "Item not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Optional: Verify item belongs to the specified server for additional security
    if (itemDetails.item.serverId !== Number.parseInt(serverId, 10)) {
      return new Response(
        JSON.stringify({
          error: "Item does not belong to the specified server",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(JSON.stringify(itemDetails), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching item details:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch item details",
        message: error instanceof Error ? error.message : "Unknown error",
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
