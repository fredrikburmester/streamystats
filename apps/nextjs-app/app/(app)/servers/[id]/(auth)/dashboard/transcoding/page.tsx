import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { setEndDateToEndOfDay } from "@/dates";
import { getServer } from "@/lib/db/server";
import {
  getTranscodingStatistics,
  getTranscodingStatisticsOverTime,
} from "@/lib/db/transcoding-statistics";

import { getMe, getUsers, isUserAdmin } from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import { TranscodingStatistics } from "../TranscodingStatistics";
import { TranscodingFilters } from "./TranscodingFilters";

export default async function TranscodingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    userId?: string;
  }>;
}) {
  const { id } = await params;
  const { startDate, endDate, userId } = await searchParams;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/not-found");
  }

  const effectiveEndDate = endDate ? setEndDateToEndOfDay(endDate) : undefined;
  const isAdmin = await isUserAdmin();
  const users = await getUsers({ serverId: server.id });

  return (
    <Container className="flex flex-col">
      <PageTitle title="Transcoding Statistics" />
      <TranscodingFilters
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        showUserFilter={isAdmin}
      />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <TranscodingStats
          server={server}
          startDate={startDate}
          endDate={effectiveEndDate}
          userId={userId}
        />
      </Suspense>
    </Container>
  );
}

async function TranscodingStats({
  server,
  startDate,
  endDate,
  userId,
}: {
  server: ServerPublic;
  startDate?: string;
  endDate?: string;
  userId?: string;
}) {
  const [isAdmin, me] = await Promise.all([isUserAdmin(), getMe()]);
  const effectiveUserId = userId ? userId : isAdmin ? undefined : me?.id;

  const [ts, history] = await Promise.all([
    getTranscodingStatistics(server.id, startDate, endDate, effectiveUserId),
    getTranscodingStatisticsOverTime(
      server.id,
      startDate,
      endDate,
      effectiveUserId,
    ),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <TranscodingStatistics data={ts} history={history} />
    </div>
  );
}
