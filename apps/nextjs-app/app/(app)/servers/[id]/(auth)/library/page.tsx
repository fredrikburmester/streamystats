import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { getLibraries } from "@/lib/db/libraries";
import {
  getLibraryItemsWithStats,
  getPerLibraryStatistics,
} from "@/lib/db/library-statistics";
import { getServer } from "@/lib/db/server";
import { getMe, isUserAdmin } from "@/lib/db/users";
import { ItemWatchStatsTable } from "./ItemWatchStatsTable";
import { LibraryStatisticsCards } from "./LibraryStatisticsCards";

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

  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/not-found");
  }

  const [isAdmin, me] = await Promise.all([isUserAdmin(), getMe()]);
  const viewerUserId = isAdmin ? undefined : me?.id;
  const libraries = await getLibraries({
    serverId: server.id,
    userId: viewerUserId,
  });
  const perLibraryStats = await getPerLibraryStatistics({
    serverId: server.id,
    userId: viewerUserId,
  });
  const items = await getLibraryItemsWithStats({
    serverId: server.id,
    userId: viewerUserId,
    page,
    sortOrder: sort_order,
    sortBy: sort_by,
    type,
    search,
    libraryIds,
  });

  return (
    <Container>
      <PageTitle
        title="Library"
        subtitle="Search for any movie or episode on your server."
      />
      <LibraryStatisticsCards
        data={perLibraryStats}
        serverId={server.id}
        isAdmin={isAdmin}
      />
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
