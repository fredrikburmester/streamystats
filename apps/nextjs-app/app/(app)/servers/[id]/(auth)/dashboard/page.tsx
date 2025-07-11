import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { getServer } from "@/lib/db/server";
import { getSimilarStatistics } from "@/lib/db/similar-statistics";
import { getSimilarSeries } from "@/lib/db/similar-series-statistics";
import { getMostWatchedItems } from "@/lib/db/statistics";
import { getMe } from "@/lib/db/users";
import { showAdminStatistics } from "@/utils/adminTools";
import { Server } from "@streamystats/database/schema";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActiveSessions } from "./ActiveSessions";
import { MostWatchedItems } from "./MostWatchedItems";
import { SimilarStatistics } from "./SimilarStatistics";
import { SimilarSeriesStatistics } from "./SimilarSeriesStatistics";
import { UserActivityWrapper } from "./UserActivityWrapper";
import { UserLeaderboard } from "./UserLeaderboard";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    userActivityStartDate: string;
    userActivityEndDate: string;
  }>;
}) {
  const { id } = await params;
  const { userActivityStartDate, userActivityEndDate } = await searchParams;
  const server = await getServer(id);

  if (!server) {
    redirect("/not-found");
  }

  const sas = await showAdminStatistics();

  return (
    <Container className="relative flex flex-col w-screen md:w-[calc(100vw-256px)]">
      {sas && (
        <div className="mb-8">
          <ActiveSessions server={server} />
        </div>
      )}
      <PageTitle title="General Statistics" />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <GeneralStats
          server={server}
          userActivityStartDate={userActivityStartDate}
          userActivityEndDate={userActivityEndDate}
        />
      </Suspense>
    </Container>
  );
}

async function GeneralStats({
  server,
  userActivityStartDate,
  userActivityEndDate,
}: {
  server: Server;
  userActivityStartDate: string;
  userActivityEndDate: string;
}) {
  const me = await getMe();
  const sas = await showAdminStatistics();

  const [similarData, similarSeriesData, data] = await Promise.all([
    getSimilarStatistics(server.id),
    getSimilarSeries(server.id),
    getMostWatchedItems(server.id, sas ? undefined : me?.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* <ServerSetupMonitor serverId={server.id} serverName={server.name} /> */}
      <SimilarStatistics data={similarData} server={server} />
      <SimilarSeriesStatistics data={similarSeriesData} server={server} />
      <MostWatchedItems data={data} server={server} />
      {sas ? (
        <>
          <UserLeaderboard server={server} />
          <UserActivityWrapper
            server={server}
            startDate={userActivityStartDate}
            endDate={userActivityEndDate}
          />
        </>
      ) : null}
    </div>
  );
}
