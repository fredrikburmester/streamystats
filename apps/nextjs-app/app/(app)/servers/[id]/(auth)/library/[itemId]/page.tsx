import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import {
  getItemCast,
  getItemDirectors,
  getItemWriters,
} from "@/lib/db/actor-types";
import { getItemDetails, getSeasonsAndEpisodes } from "@/lib/db/items";
import { getServer } from "@/lib/db/server";
import type { SeriesRecommendationItem } from "@/lib/db/similar-series-statistics";
import { getSimilarSeriesForItem } from "@/lib/db/similar-series-statistics";
import {
  getSimilarItemsForItem,
  type RecommendationItem,
} from "@/lib/db/similar-statistics";
import { getMe, isUserAdmin } from "@/lib/db/users";
import { getToken } from "@/lib/token";
import { CastSection } from "./CastSection";
import { ItemHeader } from "./ItemHeader";
import { ItemMetadata } from "./ItemMetadata";
import { SeasonsAndEpisodes } from "./SeasonsAndEpisodes";
import { SimilarItemsList } from "./SimilarItemsList";

async function getItemPlayedStatus(
  serverUrl: string,
  token: string,
  userId: string,
  itemId: string,
): Promise<boolean> {
  try {
    const response = await fetch(
      `${serverUrl}/Users/${userId}/Items/${itemId}`,
      {
        headers: { "X-Emby-Token": token },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) return false;
    const data = await response.json();
    return data.UserData?.Played ?? false;
  } catch {
    return false;
  }
}

export default async function ItemDetailsPage({
  params,
}: {
  params: Promise<{ id: number; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/not-found");
  }

  const [me, isAdmin, token] = await Promise.all([
    getMe(),
    isUserAdmin(),
    getToken(),
  ]);

  if (!me) {
    redirect("/login");
  }

  const itemDetails = await getItemDetails({
    itemId,
    userId: isAdmin ? undefined : me.id,
  });

  if (!itemDetails) {
    redirect("/not-found");
  }

  // Fetch played status from Jellyfin
  const isPlayed =
    token && server.url
      ? await getItemPlayedStatus(server.url, token, me.id, itemId)
      : false;

  // Get similar items based on the specific item (not user-based)
  let similarItems: Array<RecommendationItem | SeriesRecommendationItem> = [];

  if (itemDetails.item.type === "Series") {
    similarItems = await getSimilarSeriesForItem(server.id, itemId, 20);
  } else if (itemDetails.item.type === "Movie") {
    similarItems = await getSimilarItemsForItem(server.id, itemId, 20);
  }

  // Get seasons and episodes for series
  const seasons =
    itemDetails.item.type === "Series"
      ? await getSeasonsAndEpisodes({ seriesId: itemId })
      : [];

  // Get cast and crew for movies and series
  const [cast, directors, writers] =
    itemDetails.item.type === "Movie" || itemDetails.item.type === "Series"
      ? await Promise.all([
          getItemCast(itemId, server.id),
          getItemDirectors(itemId, server.id),
          getItemWriters(itemId, server.id),
        ])
      : [[], [], []];

  return (
    <Container className="flex flex-col">
      <div className="space-y-6 pb-10">
        <ItemHeader
          item={itemDetails.item}
          server={server}
          statistics={itemDetails}
          serverId={id}
          userId={me.id}
          isPlayed={isPlayed}
        />
        <ItemMetadata
          item={itemDetails.item}
          statistics={itemDetails}
          isAdmin={isAdmin}
          serverId={id}
          itemId={itemId}
        />
        {(itemDetails.item.type === "Movie" ||
          itemDetails.item.type === "Series") && (
          <CastSection
            cast={cast}
            directors={directors}
            writers={writers}
            server={server}
            serverId={id}
          />
        )}
        {itemDetails.item.type === "Series" && seasons.length > 0 && (
          <SeasonsAndEpisodes seasons={seasons} serverId={id} server={server} />
        )}
        {(itemDetails.item.type === "Series" ||
          itemDetails.item.type === "Movie") &&
          similarItems.length > 0 && (
            <SimilarItemsList
              items={similarItems}
              server={server}
              currentItemType={itemDetails.item.type}
            />
          )}
      </div>
    </Container>
  );
}
