import { db, servers } from "@streamystats/database";
import { ilike } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getInternalUrl } from "@/lib/server-url";

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
  let jellyfinUrl = `${getInternalUrl(server)}/Items/${itemId}/Images/Primary`;
  if (tag) {
    jellyfinUrl += `?tag=${tag}`;
  }

  try {
    const res = await fetch(jellyfinUrl, {
      method: "GET",
      // Forward headers if needed, but usually image requests are public if they have the tag?
      // Actually, Jellyfin images with ?tag= usually don't require auth if they are cached/public,
      // BUT generally API access requires token.
      // We should use the Server API Key to fetch the image.
      headers: {
        "X-Emby-Token": server.apiKey,
      },
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
