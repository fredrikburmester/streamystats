import { Container } from "@/components/Container";
import { PageTitle } from "@/components/PageTitle";
import { getUserHistory } from "@/lib/db/history";
import { getServer } from "@/lib/db/server";
import {
  getUser,
  getUserGenreStats,
  getUserWatchStats,
  getWatchTimePerWeekDay,
  isUserAdmin,
} from "@/lib/db/users";
import { formatDuration } from "@/lib/utils";
import { redirect } from "next/navigation";
import { HistoryTable } from "../../history/HistoryTable";
import { GenreStatsGraph } from "./GenreStatsGraph";
import UserBadges from "./UserBadges";
import { WatchTimePerDay } from "./WatchTimePerDay";
import { showAdminStatistics } from "@/utils/adminTools";

export default async function User({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; name: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id, name } = await params;
  const { page = "1" } = await searchParams;
  const server = await getServer(id);

  if (!server) {
    redirect("/");
  }

  const user = await getUser(name, server.id);
  if (!user) {
    redirect("/");
  }

  const showAdminStats = await showAdminStatistics();

  // Get additional user statistics and history
  const currentPage = parseInt(page);
  const [watchStats, watchTimePerWeekday, userHistory, genreStats] =
    await Promise.all([
      getUserWatchStats(server.id, user.id),
      getWatchTimePerWeekDay(server.id, showAdminStats ? undefined : user.id),
      getUserHistory(server.id, user.id, currentPage, 50),
      getUserGenreStats(user.id, server.id),
    ]);

  return (
    <Container className="flex flex-col w-screen md:w-[calc(100vw-256px)]">
      <PageTitle title={user.name || "N/A"} />
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
      <HistoryTable server={server} data={userHistory} hideUserColumn={true} />
    </Container>
  );
}
