import { requireAdmin } from "@/lib/api-auth";
import { jobServer } from "@/lib/job-server";

export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const url = new URL(request.url);
    const serverId = url.searchParams.get("serverId");

    if (!serverId) {
      return Response.json({ error: "serverId is required" }, { status: 400 });
    }

    const data = await jobServer.getJobStatus(serverId);
    return Response.json(data);
  } catch (err) {
    console.error("Error fetching server job status:", err);
    return Response.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to fetch server job status",
      },
      { status: 500 },
    );
  }
}
