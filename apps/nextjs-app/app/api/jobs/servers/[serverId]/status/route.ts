import { requireAdmin } from "@/lib/api-auth";
import { jobServer } from "@/lib/job-server";

export async function GET(
  _request: Request,
  props: { params: Promise<{ serverId: string }> },
) {
  try {
    const { error } = await requireAdmin();
    if (error) return error;

    const { serverId } = await props.params;

    const data = await jobServer.getJobStatus(serverId);
    return Response.json(data);
  } catch (error) {
    console.error("Error fetching server job status:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch server job status",
      },
      { status: 500 },
    );
  }
}
