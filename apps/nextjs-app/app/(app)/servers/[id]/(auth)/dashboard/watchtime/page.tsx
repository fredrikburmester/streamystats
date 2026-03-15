import { addDays } from "date-fns";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { Skeleton } from "@/components/ui/skeleton";
import { setEndDateToEndOfDay } from "@/dates";
import { getServer } from "@/lib/db/server";
import { getMostActiveUsersDay, getMostWatchedDay } from "@/lib/db/statistics";
import {
  getMe,
  getUserStatsSummaryForServer,
  getViewerUserId,
  getWatchTimePerHour,
  getWatchTimePerWeekDay,
  isUserAdmin,
} from "@/lib/db/users";
import type { ServerPublic } from "@/lib/types";
import Graph from "../Graph";
import TotalWatchTime from "../TotalWatchTime";
import { UserActivityWrapper } from "../UserActivityWrapper";
import { WatchTimePerHour } from "../WatchTimePerHour";
import { WatchTimePerWeekDay } from "../WatchTimePerWeekDay";
import { WatchtimeDateRangeFilter } from "./WatchtimeDateRangeFilter";
import { WatchtimeHighlights } from "./WatchtimeHighlights";
import { WatchtimeTopUsersTable } from "./WatchtimeTopUsersTable";

export default async function WatchtimePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
}) {
  const { id } = await params;
  const { startDate, endDate } = await searchParams;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/not-found");
  }

  const defaultStartDate = addDays(new Date(), -7).toISOString().split("T")[0];
  const defaultEndDate = new Date().toISOString().split("T")[0];

  const startDateParam = startDate || defaultStartDate;
  const endDateParam = endDate || defaultEndDate;

  if (!startDate || !endDate) {
    redirect(
      `/servers/${server.id}/dashboard/watchtime?startDate=${startDateParam}&endDate=${endDateParam}`,
    );
  }

  return (
    <Container className="flex flex-col">
      <PageTitle title="Watchtime Statistics" />
      <WatchtimeDateRangeFilter className="mb-6" />
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <WatchtimeStats
          server={server}
          startDate={startDateParam}
          endDate={setEndDateToEndOfDay(endDateParam)}
        />
      </Suspense>
    </Container>
  );
}

async function WatchtimeStats({
  server,
  startDate,
  endDate,
}: {
  server: ServerPublic;
  startDate: string;
  endDate: string;
}) {
  const [me, isAdmin, viewerUserId] = await Promise.all([
    getMe(),
    isUserAdmin(),
    getViewerUserId(),
  ]);

  if (!me) {
    redirect("/not-found");
  }

  const scopedUserId = isAdmin ? undefined : me.id;

  const [d1, d2, mostWatchedDay, mostActiveUsersDay, topUsers] =
    await Promise.all([
      getWatchTimePerWeekDay({
        serverId: server.id,
        userId: isAdmin ? undefined : me.id,
        startDate,
        endDate,
        viewerUserId,
      }),
      getWatchTimePerHour({
        serverId: server.id,
        userId: isAdmin ? undefined : me.id,
        startDate,
        endDate,
        viewerUserId,
      }),
      getMostWatchedDay({
        serverId: server.id,
        userId: scopedUserId,
        startDate,
        endDate,
        viewerUserId,
      }),
      isAdmin
        ? getMostActiveUsersDay({
            serverId: server.id,
            startDate,
            endDate,
            viewerUserId,
          })
        : Promise.resolve(null),
      isAdmin
        ? getUserStatsSummaryForServer({
            serverId: server.id,
            startDate,
            endDate,
          })
        : Promise.resolve([]),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <WatchtimeHighlights
        mostWatchedDay={mostWatchedDay}
        mostActiveUsersDay={mostActiveUsersDay}
        isAdmin={isAdmin}
      />
      <div className="flex md:flex-row flex-col gap-2">
        <TotalWatchTime
          server={server}
          startDate={startDate}
          endDate={endDate}
        />
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <Graph server={server} startDate={startDate} endDate={endDate} />
      </Suspense>
      <WatchTimePerWeekDay
        data={d1}
        title="Watch Time Per Day of Week"
        subtitle="Showing total watch time for each day of the week"
      />
      <WatchTimePerHour
        data={d2}
        title="Watch Time Per Hour"
        subtitle="Showing total watch time for each hour of the day"
      />
      {isAdmin ? (
        <>
          <UserActivityWrapper
            server={server}
            startDate={startDate}
            endDate={endDate}
          />
          <WatchtimeTopUsersTable server={server} users={topUsers} />
        </>
      ) : null}
    </div>
  );
}
