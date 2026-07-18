import { requireSession } from "@/lib/api-auth";
import { jobServer } from "@/lib/job-server";

interface RouteParams {
  params: Promise<{
    serverId: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireSession();
  if (auth.error) return auth.error;
  try {
    const { serverId } = await params;

    if (!serverId) {
      return Response.json({ error: "Server ID is required" }, { status: 400 });
    }

    const data = await jobServer.getSyncStatus(serverId);
    return Response.json(data);
  } catch (error) {
    console.error("Error fetching server sync status:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch server sync status",
      },
      { status: 500 },
    );
  }
}
