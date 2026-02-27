import { Shield } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { AnomalyBadge } from "@/components/locations";
import { PageTitle } from "@/components/PageTitle";
import { Button } from "@/components/ui/button";
import {
  getUniqueClientNames,
  getUniqueDeviceNames,
  getUniquePlayMethods,
  getUserHistory,
} from "@/lib/db/history";
import { getInferredSessionCount } from "@/lib/db/infer-watchtime";
import { getAlmostDoneSeries } from "@/lib/db/items";
import { getUserAnomalies } from "@/lib/db/locations";
import { getServer } from "@/lib/db/server";
import { getMostWatchedItems } from "@/lib/db/statistics";
import {
  getUserById,
  getUserGenreStats,
  getUsers,
  getUserWatchStats,
  getWatchTimePerWeekDay,
  isUserAdmin,
} from "@/lib/db/users";
import { getSession } from "@/lib/session";
import { formatDuration } from "@/lib/utils";
import { HistoryTable } from "../../history/HistoryTable";
import { AlmostDone } from "./AlmostDone";
import { GenreStatsGraph } from "./GenreStatsGraph";
import { InferWatchtimeManager } from "./InferWatchtimeManager";
import { TopItemsList } from "./TopItems";
import UserBadges from "./UserBadges";
import { UserSimilarity } from "./UserSimilarity";
import { WatchTimePerDay } from "./WatchTimePerDay";

export default async function User({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; userId: string }>;
  searchParams: Promise<{
    page?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
    startDate?: string;
    endDate?: string;
    itemType?: string;
    deviceName?: string;
    clientName?: string;
    playMethod?: string;
  }>;
}) {
  const { id, userId } = await params;
  const {
    page = "1",
    search,
    sort_by,
    sort_order,
    startDate,
    endDate,
    itemType,
    deviceName,
    clientName,
    playMethod,
  } = await searchParams;
  const server = await getServer({ serverId: id });

  if (!server) {
    redirect("/");
  }

  const user = await getUserById({ userId: userId, serverId: server.id });
  if (!user) {
    redirect("/");
  }

  const [isAdmin, currentSession] = await Promise.all([
    isUserAdmin(),
    getSession(),
  ]);

  // Check if current user is viewing their own page
  const isCurrentUser = currentSession?.id === user.id;

  // Get additional user statistics and history
  const currentPage = Number.parseInt(page, 10);
  const [
    watchStats,
    watchTimePerWeekday,
    userHistory,
    genreStats,
    mostWatched,
    almostDone,
    anomalyData,
    users,
    deviceNames,
    clientNames,
    playMethods,
    inferredSessionCount,
  ] = await Promise.all([
    getUserWatchStats({ serverId: server.id, userId: user.id }),
    getWatchTimePerWeekDay({
      serverId: server.id,
      userId: user.id,
    }),
    getUserHistory(server.id, user.id, {
      page: currentPage,
      perPage: 50,
      search: search || undefined,
      sortBy: sort_by || undefined,
      sortOrder: (sort_order as "asc" | "desc") || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      itemType: itemType || undefined,
      deviceName: deviceName || undefined,
      clientName: clientName || undefined,
      playMethod: playMethod || undefined,
    }),
    getUserGenreStats({ userId: user.id, serverId: server.id }),
    getMostWatchedItems({ serverId: server.id, userId: user.id }),
    getAlmostDoneSeries({ serverId: server.id, userId: user.id }),
    getUserAnomalies(server.id, user.id, { resolved: false, limit: 1 }),
    getUsers({ serverId: server.id }),
    getUniqueDeviceNames(server.id),
    getUniqueClientNames(server.id),
    getUniquePlayMethods(server.id),
    getInferredSessionCount(server.id, user.id),
  ]);

  return (
    <Container className="flex flex-col">
      <div className="flex items-center justify-between">
        <PageTitle title={user.name || "N/A"} />
        {isAdmin && (
          <Link href={`/servers/${server.id}/users/${user.id}/security`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Shield className="h-4 w-4" />
              Security
              {anomalyData.unresolvedCount > 0 && (
                <AnomalyBadge
                  count={anomalyData.unresolvedCount}
                  showTooltip={false}
                />
              )}
            </Button>
          </Link>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <UserBadges user={user} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm">Total Plays</p>
            <p className="text-xl font-bold">{watchStats.total_plays}</p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm">Total Watch Time</p>
            <p className="text-xl font-bold">
              {formatDuration(watchStats.total_watch_time)}
            </p>
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-sm">Longest day streak</p>
            <p className="text-xl font-bold">
              {formatDuration(watchStats.longest_streak, "days")}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <GenreStatsGraph data={genreStats} />
        <WatchTimePerDay data={watchTimePerWeekday} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <TopItemsList
          title="Top Movies"
          type="movie"
          items={mostWatched.Movie}
          server={server}
        />
        <TopItemsList
          title="Top TV Shows"
          type="series"
          items={mostWatched.Series}
          server={server}
        />
      </div>
      {almostDone.length > 0 && (
        <div className="mt-6">
          <AlmostDone data={almostDone} server={server} />
        </div>
      )}
      <div className="mt-6 mb-4">
        <UserSimilarity serverId={server.id} userId={user.id} />
      </div>
      {(isCurrentUser || isAdmin) && (
        <div className="mb-4">
          <InferWatchtimeManager
            serverId={server.id}
            userId={user.id}
            userName={user.name}
            isCurrentUser={isCurrentUser}
            inferredSessionCount={inferredSessionCount}
          />
        </div>
      )}
      <HistoryTable
        server={server}
        data={userHistory}
        hideUserColumn={true}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        deviceNames={deviceNames}
        clientNames={clientNames}
        playMethods={playMethods}
      />
    </Container>
  );
}
