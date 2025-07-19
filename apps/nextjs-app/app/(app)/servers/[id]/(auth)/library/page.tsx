import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";

import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ItemWatchStatsTable } from "./ItemWatchStatsTable";
import { LibraryStatisticsCards } from "./LibraryStatisticsCards";
import { isUserAdmin } from "@/lib/db/users";
import { getServer } from "@/lib/db/server";
import { getLibraries } from "@/lib/db/libraries";
import {
  getAggregatedLibraryStatistics,
  getLibraryItemsWithStats,
} from "@/lib/db/library-statistics";

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    page: string;
    search: string;
    sort_by: string;
    type: "Movie" | "Episode" | "Series";
    sort_order: string;
    libraries: string;
  }>;
}) {
  const { id } = await params;
  const {
    page,
    search,
    sort_by,
    sort_order,
    type,
    libraries: libraryIds,
  } = await searchParams;

  const server = await getServer(id);
  const isAdmin = await isUserAdmin();

  if (!server) {
    redirect("/not-found");
  }

  const libraries = await getLibraries(server.id);
  const libraryStats = await getAggregatedLibraryStatistics(server.id);
  const items = await getLibraryItemsWithStats(
    server.id,
    page,
    sort_order,
    sort_by,
    type,
    search,
    libraryIds
  );

  return (
    <Container>
      <PageTitle
        title="Library"
        subtitle="Search for any movie or episode on your server."
      />
      <LibraryStatisticsCards data={libraryStats} isAdmin={isAdmin} />
      <Suspense
        fallback={
          <div className="">
            <Skeleton className="w-full h-12 mb-4" />
            <Skeleton className="w-full h-64 mb-4" />
            <Skeleton className="w-full h-64" />
          </div>
        }
      >
        <ItemWatchStatsTable
          server={server}
          data={items}
          libraries={libraries}
        />
      </Suspense>
      {/* <UnwatchedTable server={server} data={unwatchedItems} /> */}
    </Container>
  );
}
