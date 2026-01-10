import { getServers } from "@/lib/db/server";
import { createServer } from "@/lib/server";

export async function GET() {
  try {
    const servers = await getServers();
    return new Response(JSON.stringify(servers), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error fetching servers:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to fetch servers",
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

/**
 * Validates that the API key belongs to an admin on the target Jellyfin server.
 */
async function validateJellyfinAdmin(
  url: string,
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(`${url}/Users/Me`, {
      method: "GET",
      headers: {
        "Authorization": `MediaBrowser Client="Streamystats", Token="${apiKey}"`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { valid: false, error: "Invalid API key" };
      }
      return {
        valid: false,
        error: `Jellyfin server returned ${response.status}`,
      };
    }

    const user = await response.json();

    if (!user.Policy?.IsAdministrator) {
      return {
        valid: false,
        error: "API key must belong to a Jellyfin administrator",
      };
    }

    return { valid: true };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { valid: false, error: "Connection to Jellyfin server timed out" };
    }
    return {
      valid: false,
      error: "Failed to connect to Jellyfin server",
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, url, apiKey, ...otherFields } = body;

    if (!name || !url || !apiKey) {
      return new Response(
        JSON.stringify({
          error: "Name, URL, and API key are required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Validate the API key belongs to an admin on the target Jellyfin server
    const validation = await validateJellyfinAdmin(url, apiKey);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: validation.error,
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const result = await createServer({ name, url, apiKey, ...otherFields });
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error creating server:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to create server",
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
