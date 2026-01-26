import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { getServer } from "@/lib/db/server";
import {
  getTranscodingStatistics,
  getTranscodingStatisticsOverTime,
} from "@/lib/db/transcoding-statistics";

import { getMe, isUserAdmin } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { TranscodingStatistics } from "../TranscodingStatistics";

export default async function TranscodingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/not-found");
  }

  return (
    <Container className="flex flex-col">
      <PageTitle title="Transcoding Statistics" />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <TranscodingStats server={server} />
      </Suspense>
    </Container>
  );
}

async function TranscodingStats({ server }: { server: ServerPublic }) {
  const [isAdmin, me] = await Promise.all([isUserAdmin(), getMe()]);
  const [ts, history] = await Promise.all([
    getTranscodingStatistics(
      server.id,
      undefined,
      undefined,
      isAdmin ? undefined : me?.id,
    ),
    getTranscodingStatisticsOverTime(
      server.id,
      undefined,
      undefined,
      isAdmin ? undefined : me?.id,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <TranscodingStatistics data={ts} history={history} />
    </div>
  );
}
