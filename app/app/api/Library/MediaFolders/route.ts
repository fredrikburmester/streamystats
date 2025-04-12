import { getServer } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const apiKey = searchParams.get("apiKey");
  const serverId = searchParams.get("serverId");

  // We either need a serverId OR a url + apiKey pair
  if (!serverId && (!url || !apiKey)) {
    return new Response("Either serverId or url and apiKey are required", {
      status: 400,
    });
  }

  let serverUrl: string;
  let serverApiKey: string;

  if (serverId) {
    const server = await getServer(serverId);
    if (!server) {
      return new Response("Server not found", { status: 404 });
    }
    serverUrl = server.url;
    serverApiKey = server.api_key;
  } else {
    serverUrl = url!;
    serverApiKey = apiKey!;
  }

  try {
    const response = await fetch(`${serverUrl}/Library/MediaFolders`, {
      method: "GET",
      headers: {
        "X-Emby-Token": serverApiKey,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Jellyfin API returned ${response.status}`);
    }

    const data = await response.json();
    const libraries = data.Items.filter(
      (library: any) =>
        library.CollectionType !== "boxsets" &&
        library.CollectionType !== "playlists",
    );

    return new Response(JSON.stringify(libraries), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching Jellyfin libraries:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch libraries from Jellyfin server",
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
