import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getRecentlyAddedItems,
  getRecentlyAddedSeriesWithEpisodes,
} from "@/lib/db/recently-added";
import { getSeasonalRecommendations } from "@/lib/db/seasonal-recommendations";
import { getServer } from "@/lib/db/server";
import { getSimilarSeries } from "@/lib/db/similar-series-statistics";
import { getSimilarStatistics } from "@/lib/db/similar-statistics";
import { getMostWatchedItems } from "@/lib/db/statistics";
import { getMe, isUserAdmin } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { ActiveSessions } from "./ActiveSessions";
import { MostWatchedItems } from "./MostWatchedItems";
import { RecentlyAdded } from "./RecentlyAdded";
import { RecentlyAddedSeries } from "./RecentlyAddedSeries";
import { SeasonalRecommendations } from "./SeasonalRecommendations";
import { SimilarSeriesStatistics } from "./SimilarSeriesStatistics";
import { SimilarMovieStatistics } from "./SimilarStatistics";
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
  const [me, isAdmin] = await Promise.all([getMe(), isUserAdmin()]);

  const [
    similarData,
    similarSeriesData,
    data,
    seasonalData,
    recentlyAddedMovies,
    recentlyAddedSeries,
  ] = await Promise.all([
    getSimilarStatistics(server.id),
    getSimilarSeries(server.id),
    getMostWatchedItems({
      serverId: server.id,
      userId: isAdmin ? undefined : me?.id,
    }),
    getSeasonalRecommendations(server.id),
    getRecentlyAddedItems(server.id, "Movie"),
    getRecentlyAddedSeriesWithEpisodes(server.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* <ServerSetupMonitor serverId={server.id} serverName={server.name} /> */}
      {seasonalData && (
        <SeasonalRecommendations data={seasonalData} server={server} />
      )}
      {recentlyAddedMovies.length > 0 && me && (
        <RecentlyAdded
          items={recentlyAddedMovies}
          server={server}
          itemType="Movie"
          userId={me.id}
        />
      )}
      {recentlyAddedSeries.length > 0 && me && (
        <RecentlyAddedSeries
          items={recentlyAddedSeries}
          server={server}
          userId={me.id}
        />
      )}
      {similarData.length > 0 && (
        <SimilarMovieStatistics data={similarData} server={server} />
      )}
      {similarSeriesData.length > 0 && (
        <SimilarSeriesStatistics data={similarSeriesData} server={server} />
      )}
      <MostWatchedItems data={data} server={server} />
      {isAdmin ? <UserLeaderboard server={server} /> : null}
    </div>
  );
}
