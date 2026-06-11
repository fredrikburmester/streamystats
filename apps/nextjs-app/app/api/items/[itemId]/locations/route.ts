import type { NextRequest } from "next/server";
import { requireApiKey } from "@/lib/api-auth";
import { getItemLocations } from "@/lib/db/locations";
import { getServerWithSecrets } from "@/lib/db/server";

// GET /api/items/[itemId]/locations?serverId= — countries an item was watched
// from. API-key auth, same as /api/get-item-details.
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const serverIdParam = request.nextUrl.searchParams.get("serverId");

  if (!itemId) {
    return jsonResponse({ error: "itemId is required" }, 400);
  }
  if (!serverIdParam) {
    return jsonResponse({ error: "serverId query parameter is required" }, 400);
  }

  const serverId = Number(serverIdParam);
  if (!Number.isInteger(serverId)) {
    return jsonResponse({ error: "serverId must be a number" }, 400);
  }

  const server = await getServerWithSecrets({ serverId });
  if (!server) {
    return jsonResponse({ error: "Server not found" }, 404);
  }

  const authError = await requireApiKey({ request, server });
  if (authError) {
    return authError;
  }

  const locations = await getItemLocations({
    itemId,
    serverId: server.id,
  });

  return jsonResponse(locations);
}
