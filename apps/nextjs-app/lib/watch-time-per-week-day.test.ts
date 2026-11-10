import { describe, expect, test } from "bun:test";
import { mapWatchTimePerWeekDayByType } from "./watch-time-per-week-day";

describe("mapWatchTimePerWeekDayByType", () => {
  test("groups media types by weekday and fills days without sessions", () => {
    const result = mapWatchTimePerWeekDayByType([
      { weekDay: "Monday", itemType: "Movie", watchTime: "3600" },
      { weekDay: "Monday", itemType: "Movie", watchTime: "600" },
      { weekDay: "Monday", itemType: "Episode", watchTime: "1800" },
      { weekDay: "Monday", itemType: "Audio", watchTime: "300" },
      { weekDay: "Monday", itemType: "Series", watchTime: "120" },
    ]);

    expect(result).toHaveLength(7);
    expect(result[0]).toEqual({
      day: "Monday",
      Episode: 1800,
      Movie: 4200,
      Music: 300,
      Other: 120,
    });
    expect(result[1]).toEqual({
      day: "Tuesday",
      Episode: 0,
      Movie: 0,
      Music: 0,
      Other: 0,
    });
    expect(
      result[0].Episode + result[0].Movie + result[0].Music + result[0].Other,
    ).toBe(6420);
  });
});
