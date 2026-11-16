import { startOfMonth, startOfWeek, startOfYear } from "date-fns";

export interface WatchTimePeriodStarts {
  year: Date;
  month: Date;
  week: Date;
}

export interface WatchTimePeriodTotals {
  total: number;
  year: number;
  month: number;
  week: number;
}

/**
 * Start of the current calendar year, month and week (weeks begin on Monday,
 * like the "Watch Time Per Day of Week" chart) in the server's local time.
 */
export function getWatchTimePeriodStarts(
  now: Date = new Date(),
): WatchTimePeriodStarts {
  return {
    year: startOfYear(now),
    month: startOfMonth(now),
    week: startOfWeek(now, { weekStartsOn: 1 }),
  };
}

interface WatchTimePeriodTotalsRow {
  total: string | null;
  year: string | null;
  month: string | null;
  week: string | null;
}

export function mapWatchTimePeriodTotals(
  row: WatchTimePeriodTotalsRow | undefined,
): WatchTimePeriodTotals {
  return {
    total: Number(row?.total ?? 0),
    year: Number(row?.year ?? 0),
    month: Number(row?.month ?? 0),
    week: Number(row?.week ?? 0),
  };
}
