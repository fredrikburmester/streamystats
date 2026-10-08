import { type NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { z } from "zod/v4";
import { getServerWithSecrets } from "@/lib/db/server";
import { getInternalUrl } from "@/lib/server-url";

const bodySchema = z.object({
  serverId: z.number().int().positive(),
  itemIds: z.array(z.string().min(1)).min(1).max(4),
});

// A 2x2 grid in poster proportions, so it reads like any other cover.
const TILE_WIDTH = 300;
const TILE_HEIGHT = 450;

/**
 * A 2x2 poster collage of the given items, as a JPEG, for the job server to
 * set as a recommendation collection's cover. Internal callers only.
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
  const server = await getServerWithSecrets({ serverId: parsed.data.serverId });
  if (!server) {
    return NextResponse.json({ error: "Server not found" }, { status: 404 });
  }
  const baseUrl = getInternalUrl(server);

  const tiles: Buffer[] = [];
  for (const itemId of parsed.data.itemIds) {
    try {
      const response = await fetch(
        `${baseUrl}/Items/${itemId}/Images/Primary?fillWidth=${TILE_WIDTH}&fillHeight=${TILE_HEIGHT}&quality=90`,
        { headers: { "X-Emby-Token": server.apiKey } },
      );
      if (!response.ok) continue;
      tiles.push(
        await sharp(Buffer.from(await response.arrayBuffer()))
          .resize(TILE_WIDTH, TILE_HEIGHT, { fit: "cover" })
          .toBuffer(),
      );
    } catch {
      // A missing poster just leaves its tile to the next one.
    }
  }
  if (tiles.length === 0) {
    return NextResponse.json({ error: "No posters" }, { status: 404 });
  }

  // Fewer than four posters: repeat them so the grid is never half empty.
  const grid = [0, 1, 2, 3].map((i) => tiles[i % tiles.length]);
  const collage = await sharp({
    create: {
      width: TILE_WIDTH * 2,
      height: TILE_HEIGHT * 2,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  })
    .composite(
      grid.flatMap((input, i) =>
        input
          ? [
              {
                input,
                left: (i % 2) * TILE_WIDTH,
                top: Math.floor(i / 2) * TILE_HEIGHT,
              },
            ]
          : [],
      ),
    )
    .jpeg({ quality: 88 })
    .toBuffer();

  return new NextResponse(new Uint8Array(collage), {
    headers: { "Content-Type": "image/jpeg" },
  });
}
