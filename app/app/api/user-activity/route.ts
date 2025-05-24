import { getUserActivityStatistics } from "@/lib/db";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get("serverId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!serverId || !startDate || !endDate) {
    return Response.json(
      { error: "Missing required parameters: serverId, startDate, endDate" },
      { status: 400 }
    );
  }

  try {
    const data = await getUserActivityStatistics(
      parseInt(serverId),
      startDate,
      endDate
    );

    return Response.json({ data });
  } catch (error) {
    console.error("Error fetching user activity:", error);
    return Response.json(
      { error: "Failed to fetch user activity statistics" },
      { status: 500 }
    );
  }
}
