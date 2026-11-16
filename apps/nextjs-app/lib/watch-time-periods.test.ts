import { describe, expect, test } from "bun:test";
import {
  getWatchTimePeriodStarts,
  mapWatchTimePeriodTotals,
} from "./watch-time-periods";

describe("getWatchTimePeriodStarts", () => {
  test("returns the start of the current year, month and week", () => {
    // Wednesday, 13 August 2025
    const starts = getWatchTimePeriodStarts(new Date(2025, 7, 13, 15, 30));

    expect(starts.year).toEqual(new Date(2025, 0, 1));
    expect(starts.month).toEqual(new Date(2025, 7, 1));
    expect(starts.week).toEqual(new Date(2025, 7, 11));
  });

  test("starts the week on Monday, even when that falls in the previous month and year", () => {
    // Sunday, 4 January 2026 belongs to the week that began on 29 December 2025
    const starts = getWatchTimePeriodStarts(new Date(2026, 0, 4, 23, 59));

    expect(starts.week).toEqual(new Date(2025, 11, 29));
    expect(starts.month).toEqual(new Date(2026, 0, 1));
    expect(starts.year).toEqual(new Date(2026, 0, 1));
  });

  test("treats Monday midnight as the start of its own week", () => {
    const starts = getWatchTimePeriodStarts(new Date(2025, 7, 11, 0, 0));

    expect(starts.week).toEqual(new Date(2025, 7, 11));
  });
});

describe("mapWatchTimePeriodTotals", () => {
  test("converts the summed seconds to numbers", () => {
    expect(
      mapWatchTimePeriodTotals({
        total: "10000",
        year: "5000",
        month: "300",
        week: "20",
      }),
    ).toEqual({ total: 10000, year: 5000, month: 300, week: 20 });
  });

  test("falls back to zero when there are no sessions", () => {
    const empty = { total: 0, year: 0, month: 0, week: 0 };

    expect(mapWatchTimePeriodTotals(undefined)).toEqual(empty);
    expect(
      mapWatchTimePeriodTotals({
        total: null,
        year: null,
        month: null,
        week: null,
      }),
    ).toEqual(empty);
  });
});
