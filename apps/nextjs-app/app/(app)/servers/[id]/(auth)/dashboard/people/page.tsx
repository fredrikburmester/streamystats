import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import type { MediaTypeFilter, PlayCountSortBy } from "@/lib/db/people-stats";
import { getServer } from "@/lib/db/server";
import { PeopleStats } from "./PeopleStats";
import { PeopleTypeTabs } from "./PeopleTypeTabs";

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mediaType?: string; playCountSort?: string }>;
}) {
  const { id } = await params;
  const { mediaType, playCountSort } = await searchParams;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/not-found");
  }

  // Validate mediaType parameter
  const effectiveMediaType: MediaTypeFilter =
    mediaType === "Movie" || mediaType === "Series" ? mediaType : "all";

  // Validate playCountSort parameter
  const effectivePlayCountSort: PlayCountSortBy =
    playCountSort === "playCount" ? "playCount" : "titleCount";

  return (
    <Container className="flex flex-col">
      <PageTitle title="People Statistics" />
      <PeopleTypeTabs currentMediaType={effectiveMediaType} />
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
            <Skeleton className="h-72 w-full rounded-lg" />
          </div>
        }
      >
        <PeopleStats
          server={server}
          mediaType={effectiveMediaType}
          playCountSort={effectivePlayCountSort}
        />
      </Suspense>
    </Container>
  );
}
