import { requireAdmin } from "@/lib/api-auth";
import { jobServer } from "@/lib/job-server";

export async function POST(request: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { serverId, libraryId } = body;

    if (!serverId) {
      return Response.json({ error: "Server ID is required" }, { status: 400 });
    }

    if (!libraryId) {
      return Response.json(
        { error: "Library ID is required" },
        { status: 400 },
      );
    }

    const data = await jobServer.triggerLibrarySync(serverId, libraryId);
    return Response.json(data);
  } catch (error) {
    console.error("Error triggering library sync:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to trigger library sync",
      },
      { status: 500 },
    );
  }
}
