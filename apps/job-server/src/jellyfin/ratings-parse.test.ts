import { describe, expect, test } from "bun:test";
import {
  opinionToRating,
  parseJellyfinEnhancedReviewPage,
  parseOpinionUserData,
  parseReviewTarget,
} from "./ratings-parse";

describe("parseReviewTarget", () => {
  test("movie", () => {
    expect(parseReviewTarget("movie", "603")).toEqual({ kind: "movie", tmdbId: "603" });
  });
  test("series, season and episode keys", () => {
    expect(parseReviewTarget("tv", "1418")).toEqual({ kind: "series", tmdbId: "1418" });
    expect(parseReviewTarget("tv", "1418:s4")).toEqual({
      kind: "season",
      seriesTmdbId: "1418",
      season: 4,
    });
    expect(parseReviewTarget("tv", "655:s6:e2")).toEqual({
      kind: "episode",
      seriesTmdbId: "655",
      season: 6,
      episode: 2,
    });
  });
  test("rejects malformed keys", () => {
    expect(parseReviewTarget("movie", "603:s1")).toBeNull();
    expect(parseReviewTarget("tv", "abc")).toBeNull();
    expect(parseReviewTarget("tv", "1418:4")).toBeNull();
    expect(parseReviewTarget("tv", "1418:s4:e1:x")).toBeNull();
  });
});

describe("parseJellyfinEnhancedReviewPage", () => {
  // Shape of GET /JellyfinEnhanced/reviews/admin/all (plugin 12.11).
  const page = {
    reviews: [
      {
        userId: "45e7d77f329d408eaefb7301c9c4a8cc",
        userName: "someone",
        tmdbId: "655:s6:e2",
        mediaType: "tv",
        content: "",
        rating: 4,
        createdAt: "2023-01-31T18:40:21+00:00",
        updatedAt: "2023-01-31T18:40:21+00:00",
      },
      { userId: "u", tmdbId: "603", mediaType: "movie", content: "text only", rating: null },
      { userId: "u", tmdbId: "603", mediaType: "music", rating: 5 },
    ],
    total: 3,
    offset: 0,
    limit: 1000,
  };

  test("keeps scored reviews and drops text-only or unknown media", () => {
    const parsed = parseJellyfinEnhancedReviewPage(page);
    expect(parsed?.total).toBe(3);
    // Paging counts every entry, including the ones filtered out.
    expect(parsed?.pageSize).toBe(3);
    expect(parsed?.reviews).toEqual([
      {
        userId: "45e7d77f329d408eaefb7301c9c4a8cc",
        mediaType: "tv",
        tmdbId: "655:s6:e2",
        rating: 4,
        content: null,
        updatedAt: "2023-01-31T18:40:21+00:00",
      },
    ]);
  });

  test("rejects a response that is not a review page", () => {
    expect(parseJellyfinEnhancedReviewPage({ success: false })).toBeNull();
    expect(parseJellyfinEnhancedReviewPage("<html>")).toBeNull();
  });
});

describe("native opinions", () => {
  test("only items with an opinion are kept", () => {
    expect(parseOpinionUserData({ IsFavorite: false, Likes: null })).toBeNull();
    expect(parseOpinionUserData({ IsFavorite: false })).toBeNull();
    expect(parseOpinionUserData(undefined)).toBeNull();
    expect(parseOpinionUserData({ IsFavorite: false, Likes: true })).toEqual({
      IsFavorite: false,
      Likes: true,
    });
  });

  test("favorite > like > dislike", () => {
    expect(opinionToRating({ IsFavorite: true, Likes: false })).toBe(5);
    expect(opinionToRating({ IsFavorite: false, Likes: true })).toBe(4);
    expect(opinionToRating({ IsFavorite: false, Likes: false })).toBe(1);
  });
});
