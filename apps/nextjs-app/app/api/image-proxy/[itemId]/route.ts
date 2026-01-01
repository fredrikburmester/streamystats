import { db, servers } from "@streamystats/database";
import { ilike } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getAuthHeaders } from "@/lib/jellyfin-headers";

async function getServerByName(name: string) {
  const result = await db
    .select()
    .from(servers)
    .where(ilike(servers.name, name))
    .limit(1);
  return result[0];
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const serverName = searchParams.get("serverName");
  const tag = searchParams.get("tag");

  if (!serverName) {
    return new Response("Missing serverName", { status: 400 });
  }

  const server = await getServerByName(serverName);
  if (!server) {
    return new Response("Server not found", { status: 404 });
  }

  // Construct Jellyfin Image URL
  // Default to Primary image
  let jellyfinUrl = `${server.url}/Items/${itemId}/Images/Primary`;
  if (tag) {
    jellyfinUrl += `?tag=${tag}`;
  }

  try {
    const res = await fetch(jellyfinUrl, {
      method: "GET",
      headers: getAuthHeaders(server.apiKey, { id: server.id, version: server.version }),
    });

    if (!res.ok) {
      return new Response(`Jellyfin Error: ${res.status}`, {
        status: res.status,
      });
    }

    // Forward content type
    const contentType = res.headers.get("Content-Type") || "image/jpeg";

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
