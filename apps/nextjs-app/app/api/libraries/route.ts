import { requireAdmin } from "@/lib/api-auth";
import { getLibraries } from "@/lib/db/libraries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get("serverId");

    if (!serverId) {
      return new Response(
        JSON.stringify({
          error: "Server ID is required",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const { error } = await requireAdmin(serverId);
    if (error) return error;

    const libraries = await getLibraries({
      serverId: Number.parseInt(serverId, 10),
    });

    return new Response(
      JSON.stringify({
        success: true,
        libraries,
        count: libraries.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching libraries:", error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error ? error.message : "Failed to fetch libraries",
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
