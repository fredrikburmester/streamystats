import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { UnwatchedTable } from "@/components/UnwatchedTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLibraries,
  getLibraryItems,
  getServer,
  getStatisticsLibrary,
  getUnwatchedItems,
} from "@/lib/db";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ItemWatchStatsTable } from "./ItemWatchStatsTable";
import LibraryList from "./LibraryDropdown";
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
  const server = await getServer(id);

  if (!server) {
    redirect("/not-found");
  }

  const libraries = await getLibraries(server.id);
  const libraryStats = await getStatisticsLibrary(server.id);
  const items = await getLibraryItems(
    server.id,
    page,
    sort_order,
    sort_by,
    type,
    search,
    libraryIds,
  );

  return (
    <Container>
      <PageTitle
        title="Library"
        subtitle="Search for any movie or episode on your server."
      />
      <LibraryStatisticsCards data={libraryStats} />
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
