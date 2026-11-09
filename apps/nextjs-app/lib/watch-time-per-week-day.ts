export interface WatchTimePerWeekDayByType {
  day: string;
  Episode: number;
  Movie: number;
  Music: number;
  Other: number;
}

interface WatchTimePerWeekDayByTypeRow {
  weekDay: string | null;
  itemType: string;
  watchTime: string | null;
}

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function mapWatchTimePerWeekDayByType(
  rows: WatchTimePerWeekDayByTypeRow[],
): WatchTimePerWeekDayByType[] {
  const resultMap: Record<string, Omit<WatchTimePerWeekDayByType, "day">> = {};

  for (const row of rows) {
    if (!row.weekDay) continue;

    let dayTotals = resultMap[row.weekDay];
    if (!dayTotals) {
      dayTotals = { Episode: 0, Movie: 0, Music: 0, Other: 0 };
      resultMap[row.weekDay] = dayTotals;
    }
    const category =
      row.itemType === "Movie"
        ? "Movie"
        : row.itemType === "Episode"
          ? "Episode"
          : row.itemType === "Audio"
            ? "Music"
            : "Other";

    dayTotals[category] += Number(row.watchTime || 0);
  }

  return daysOfWeek.map((day) => ({
    day,
    ...(resultMap[day] ?? { Episode: 0, Movie: 0, Music: 0, Other: 0 }),
  }));
}
