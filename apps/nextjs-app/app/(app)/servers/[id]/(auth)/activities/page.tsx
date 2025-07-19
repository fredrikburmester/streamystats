import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActivityLogTable } from "./ActivityLogTable";
import { getServer } from "@/lib/db/server";
import { getActivities } from "@/lib/db/activities";

export default async function ActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page: string }>;
}) {
  const { id } = await params;
  const { page } = await searchParams;

  const server = await getServer(id);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  if (!server) {
    redirect(`${basePath}/setup`);
  }

  const activities = await getActivities(server.id, {
    page: page ? parseInt(page, 10) : 1,
  });

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle title="Activity Log" subtitle="All events on your server." />
      <Suspense
        fallback={
          <div className="flex flex-col gap-2 items-end">
            <Skeleton className="w-32 h-10" />
            <Skeleton className="w-full h-[calc(100svh-200px)] " />
          </div>
        }
      >
        <ActivityLogTable server={server} data={activities} />
      </Suspense>
    </Container>
  );
}
