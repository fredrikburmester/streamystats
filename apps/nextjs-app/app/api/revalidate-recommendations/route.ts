import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { revalidateSeriesRecommendations } from "@/lib/db/similar-series-statistics";
import { revalidateRecommendations } from "@/lib/db/similar-statistics";

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth.error) return auth.error;

  try {
    const { serverId, userId } = await req.json();

    if (!serverId) {
      return NextResponse.json(
        { error: "serverId is required" },
        { status: 400 },
      );
    }

    const serverIdNum = Number(serverId);

    await Promise.all([
      revalidateSeriesRecommendations(serverIdNum, userId),
      revalidateRecommendations(serverIdNum, userId),
    ]);

    return NextResponse.json({
      success: true,
      message: `Recommendations cache revalidated for server ${serverId}`,
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to revalidate recommendations cache" },
      { status: 500 },
    );
  }
}
