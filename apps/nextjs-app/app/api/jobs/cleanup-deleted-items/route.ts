import { requireAdmin } from "@/lib/api-auth";
import { jobServer } from "@/lib/job-server";

export async function POST(request: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const body = await request.json();
    const { serverId } = body;

    if (!serverId) {
      return Response.json({ error: "Server ID is required" }, { status: 400 });
    }

    const data = await jobServer.cleanupDeletedItems(serverId);
    return Response.json(data);
  } catch (error) {
    console.error("Error cleaning up deleted items:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to cleanup deleted items",
      },
      { status: 500 },
    );
  }
}
