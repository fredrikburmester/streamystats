import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { getForYouRecommendations } from "@/lib/db/recommendations";
import { getSeasonalRecommendations } from "@/lib/db/seasonal-recommendations";
import { getServer } from "@/lib/db/server";
import { getMostWatchedItems } from "@/lib/db/statistics";
import { getMe, getViewerUserId, isUserAdmin } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { ActiveSessions } from "./ActiveSessions";
import { ForYouMovies, ForYouSeries } from "./ForYouSection";
import { MostWatchedItems } from "./MostWatchedItems";
import { SeasonalRecommendations } from "./SeasonalRecommendations";
import { UserLeaderboard } from "./UserLeaderboard";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Container className="relative flex flex-col">
      <Suspense fallback={<Skeleton className="h-48 w-full mb-8" />}>
        <DashboardContent serverId={id} />
      </Suspense>
    </Container>
  );
}

async function DashboardContent({ serverId }: { serverId: string }) {
  const server = await getServer({ serverId });

  if (!server) {
    redirect("/not-found");
  }

  const isAdmin = await isUserAdmin();

  return (
    <>
      {isAdmin && (
        <div className="mb-8">
          <ActiveSessions server={server} />
        </div>
      )}
      <PageTitle title="Home" />
      <GeneralStats server={server} />
    </>
  );
}

async function GeneralStats({ server }: { server: ServerPublic }) {
  const [me, isAdmin, viewerUserId] = await Promise.all([
    getMe(),
    isUserAdmin(),
    getViewerUserId(),
  ]);

  const [forYouMovies, forYouSeries, data, seasonalData] = await Promise.all([
    getForYouRecommendations({
      serverId: server.id,
      userId: me?.id,
      mediaType: "Movie",
      viewerUserId,
    }),
    getForYouRecommendations({
      serverId: server.id,
      userId: me?.id,
      mediaType: "Series",
      viewerUserId,
    }),
    getMostWatchedItems({
      serverId: server.id,
      userId: isAdmin ? undefined : me?.id,
      viewerUserId,
    }),
    getSeasonalRecommendations({ serverId: server.id, viewerUserId }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {seasonalData && (
        <SeasonalRecommendations data={seasonalData} server={server} />
      )}
      <ForYouMovies data={forYouMovies} server={server} />
      <ForYouSeries data={forYouSeries} server={server} />
      <MostWatchedItems data={data} server={server} />
      {isAdmin ? <UserLeaderboard server={server} /> : null}
    </div>
  );
}
