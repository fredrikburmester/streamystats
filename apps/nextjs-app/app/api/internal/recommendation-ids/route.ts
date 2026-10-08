import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { alternate } from "@/lib/db/rating-signals-pick";
import { getSimilarSeries } from "@/lib/db/similar-series-statistics";
import { getSimilarStatistics } from "@/lib/db/similar-statistics";

const bodySchema = z.object({
  serverId: z.number().int().positive(),
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(100),
});

/**
 * A user's top recommended movie and series ids, for the job server to mirror
 * into Jellyfin. Internal callers only: the job server holds the key.
 */
export async function POST(req: NextRequest) {
  const internalKey = req.headers.get("x-internal-key");
  const expectedSecret =
    process.env.INTERNAL_API_KEY || process.env.SESSION_SECRET;
  if (!expectedSecret || !internalKey || internalKey !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const { serverId, userId, limit } = parsed.data;

  try {
    // The user is also the viewer, so their own library access applies.
    const [movies, series] = await Promise.all([
      getSimilarStatistics({ serverId, userId, viewerUserId: userId, limit }),
      getSimilarSeries({ serverId, userId, viewerUserId: userId, limit }),
    ]);
    const ids = alternate(movies, series)
      .map((rec) => rec.item.id)
      .slice(0, limit);
    return NextResponse.json({ ids });
  } catch {
    return NextResponse.json(
      { error: "Failed to compute recommendations" },
      { status: 500 },
    );
  }
}
