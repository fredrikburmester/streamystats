import { Server, getStatistics } from "@/lib/db";
import MostWatchedDate from "./MostWatchedDate";
import { MostWatchedItems } from "./MostWatchedItems";
import TotalWatchTime from "./TotalWatchTime";
import { WatchTimePerWeekDay } from "./WatchTimePerWeekDay";
import { WatchTimePerHour } from "./WatchTimePerHour";
import { TranscodingStatistics } from "./TranscodingStatistics";
import { getTranscodingStatistics } from "@/lib/db/transcoding-statistics";
import Graph from "./Graph";
import { UserLeaderboard } from "./UserLeaderboard";
import { isUserAdmin } from "@/lib/me";
import { SimilarStatstics } from "./SimilarStatstics";
import { getSimilarStatistics } from "@/lib/db/similar-statistics";

export async function StatsWithSuspense({
  server,
  startDate,
  endDate,
}: {
  server: Server;
  startDate: string;
  endDate: string;
}) {
  const data = await getStatistics(server.id, startDate, endDate);
  const ts = await getTranscodingStatistics(server.id);
  const isAdmin = await isUserAdmin();
  const similarItems = await getSimilarStatistics(server.id);

  if (!data) {
    return <p>No data available</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="flex md:flex-row flex-col gap-2">
        <TotalWatchTime data={data.total_watch_time} />
        <MostWatchedDate data={data.most_watched_date} />
      </div>
      <MostWatchedItems data={data.most_watched_items} server={server} />
      <SimilarStatstics data={similarItems} server={server} />

      {/* <WatchTimePerWeekDay
        data={data.average_watchtime_per_week_day}
        title="Average Watch Time Per Day of Week"
        subtitle="Showing average watch time for each day of the week"
      /> */}
      <Graph server={server} startDate={startDate} endDate={endDate} />
      {isAdmin ? <UserLeaderboard server={server} /> : null}
      <WatchTimePerWeekDay
        data={data.watchtime_per_week_day}
        title="Watch Time Per Day of Week"
        subtitle="Showing total watch time for each day of the week"
      />
      <WatchTimePerHour
        data={data.watchtime_per_hour}
        title="Watch Time Per Hour"
        subtitle="Showing total watch time for each hour of the day"
      />
      <TranscodingStatistics data={ts} />
    </div>
  );
}
export default StatsWithSuspense;
