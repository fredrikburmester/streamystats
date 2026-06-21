import { format, subDays } from "date-fns";
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

  // Default to 90d if no dates are provided
  if (!startDate && !endDate) {
    const today = new Date();
    const start = subDays(today, 90);
    const query = new URLSearchParams();
    query.set("startDate", format(start, "yyyy-MM-dd"));
    query.set("endDate", format(today, "yyyy-MM-dd"));
    if (userId) query.set("userId", userId);

    redirect(`/servers/${id}/dashboard/transcoding?${query.toString()}`);
  }

  const isAllTime = startDate === "all";
  const effectiveStartDate = isAllTime ? undefined : startDate;
  const effectiveEndDate =
    isAllTime || !endDate ? undefined : setEndDateToEndOfDay(endDate);

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
          startDate={effectiveStartDate}
          endDate={effectiveEndDate}
          userId={userId}
          isAdmin={isAdmin}
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
  isAdmin,
}: {
  server: ServerPublic;
  startDate?: string;
  endDate?: string;
  userId?: string;
  isAdmin: boolean;
}) {
  const me = await getMe();
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
