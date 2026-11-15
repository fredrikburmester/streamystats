import { describe, expect, test } from "bun:test";
import {
  buildEnhancedRows,
  episodeKey,
  resolveReviewItemId,
  type ReviewLookups,
} from "./ratings";

const lookups: ReviewLookups = {
  movieByTmdb: new Map([["603", "movie-matrix"]]),
  seriesByTmdb: new Map([["655", "series-tng"]]),
  episodeByNumber: new Map([
    [episodeKey({ seriesId: "series-tng", season: 6, episode: 2 }), "ep-tng-6x2"],
  ]),
};

describe("resolveReviewItemId", () => {
  test("movies, series and episodes resolve to library items", () => {
    expect(resolveReviewItemId({ kind: "movie", tmdbId: "603" }, lookups)).toBe("movie-matrix");
    expect(resolveReviewItemId({ kind: "series", tmdbId: "655" }, lookups)).toBe("series-tng");
    expect(
      resolveReviewItemId({ kind: "episode", seriesTmdbId: "655", season: 6, episode: 2 }, lookups)
    ).toBe("ep-tng-6x2");
  });

  test("a season review lands on its series", () => {
    expect(
      resolveReviewItemId({ kind: "season", seriesTmdbId: "655", season: 3 }, lookups)
    ).toBe("series-tng");
  });

  test("titles not in the library resolve to null", () => {
    expect(resolveReviewItemId({ kind: "movie", tmdbId: "1" }, lookups)).toBeNull();
    expect(
      resolveReviewItemId({ kind: "episode", seriesTmdbId: "655", season: 9, episode: 9 }, lookups)
    ).toBeNull();
    expect(
      resolveReviewItemId({ kind: "episode", seriesTmdbId: "999", season: 1, episode: 1 }, lookups)
    ).toBeNull();
  });
});

describe("buildEnhancedRows", () => {
  test("keeps known users, records unmatched titles with a null item", () => {
    const rows = buildEnhancedRows({
      serverId: 1,
      knownUserIds: new Set(["u1"]),
      lookups,
      reviews: [
        { userId: "u1", mediaType: "tv", tmdbId: "655:s6:e2", rating: 5, content: null, updatedAt: "2025-12-30T05:37:34+00:00" },
        { userId: "u1", mediaType: "movie", tmdbId: "1", rating: 2, content: "meh", updatedAt: null },
        { userId: "stranger", mediaType: "movie", tmdbId: "603", rating: 5, content: null, updatedAt: null },
        { userId: "u1", mediaType: "tv", tmdbId: "bogus", rating: 5, content: null, updatedAt: null },
      ],
    });
    expect(rows.map((r) => [r.sourceKey, r.itemId, r.rating])).toEqual([
      ["tv:655:s6:e2", "ep-tng-6x2", 5],
      ["movie:1", null, 2],
    ]);
    expect(rows[0]?.ratedAt?.toISOString()).toBe("2025-12-30T05:37:34.000Z");
    expect(rows[1]?.review).toBe("meh");
  });
});
