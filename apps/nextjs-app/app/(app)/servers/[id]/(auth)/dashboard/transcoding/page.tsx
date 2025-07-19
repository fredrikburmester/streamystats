import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { getServer } from "@/lib/db/server";
import { getTranscodingStatistics } from "@/lib/db/transcoding-statistics";
import { getMe } from "@/lib/db/users";
import { showAdminStatistics } from "@/utils/adminTools";
import { Server } from "@streamystats/database";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TranscodingStatistics } from "../TranscodingStatistics";

export default async function TranscodingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer(id);

  if (!server) {
    redirect("/not-found");
  }

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle title="Transcoding Statistics" />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <TranscodingStats server={server} />
      </Suspense>
    </Container>
  );
}

async function TranscodingStats({ server }: { server: Server }) {
  const sas = await showAdminStatistics();
  const me = await getMe();
  const ts = await getTranscodingStatistics(
    server.id,
    undefined,
    undefined,
    sas ? undefined : me?.id
  );

  return (
    <div className="flex flex-col gap-6">
      <TranscodingStatistics data={ts} />
    </div>
  );
}
