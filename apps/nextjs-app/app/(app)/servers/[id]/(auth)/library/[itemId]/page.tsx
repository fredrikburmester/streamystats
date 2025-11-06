import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { getServer } from "@/lib/db/server";
import { getItemDetails } from "@/lib/db/items";
import {
  getSimilarItemsForItem,
  RecommendationItem,
} from "@/lib/db/similar-statistics";
import { getSimilarSeriesForItem } from "@/lib/db/similar-series-statistics";
import { showAdminStatistics } from "@/utils/adminTools";
import { redirect } from "next/navigation";
import { ItemHeader } from "./ItemHeader";
import { ItemMetadata } from "./ItemMetadata";
import { SimilarItemsList } from "./SimilarItemsList";
import { getMe } from "@/lib/db/users";

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

  const me = await getMe();
  const showAdmin = await showAdminStatistics();

  const itemDetails = await getItemDetails({
    itemId,
    userId: showAdmin ? undefined : me?.id,
  });

  if (!itemDetails) {
    redirect("/not-found");
  }

  // Get similar items based on the specific item (not user-based)
  let similarItems: RecommendationItem[] = [];

  if (itemDetails.item.type === "Series") {
    similarItems = await getSimilarSeriesForItem(server.id, itemId, 8);
  } else if (itemDetails.item.type === "Movie") {
    similarItems = await getSimilarItemsForItem(server.id, itemId, 8);
  }

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle
        title={itemDetails.item.name}
        subtitle={`${itemDetails.item.type} Details`}
      />

      <div className="space-y-6">
        <ItemHeader
          item={itemDetails.item}
          server={server}
          statistics={itemDetails}
        />
        <ItemMetadata
          item={itemDetails.item}
          statistics={itemDetails}
          showAdminStats={showAdmin}
          serverId={id}
          itemId={itemId}
        />
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
