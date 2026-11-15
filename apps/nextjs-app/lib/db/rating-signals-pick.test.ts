import { describe, expect, test } from "bun:test";
import {
  alternate,
  isNearerToDislike,
  pickRatingSignals,
  RATING_SEED_LIMIT,
  type RatingRow,
  relativeSimilarity,
} from "./rating-signals-pick";

const row = (
  overrides: Partial<RatingRow> & { itemId: string },
): RatingRow => ({
  type: "Movie",
  rating: 3,
  ratedAt: null,
  seriesId: null,
  hasEmbedding: true,
  ...overrides,
});

describe("pickRatingSignals", () => {
  test("liked seeds are 4+, strongest then most recent first", () => {
    const signals = pickRatingSignals([
      row({ itemId: "four-old", rating: 4, ratedAt: new Date("2024-01-01") }),
      row({ itemId: "five", rating: 5 }),
      row({ itemId: "four-new", rating: 4, ratedAt: new Date("2025-01-01") }),
      row({ itemId: "three", rating: 3 }),
    ]);
    expect(signals.likedItemIds).toEqual(["five", "four-new", "four-old"]);
  });

  test("disliked are 2 and below, worst first", () => {
    const signals = pickRatingSignals([
      row({ itemId: "two", rating: 2 }),
      row({ itemId: "one", rating: 1 }),
      row({ itemId: "three", rating: 3 }),
    ]);
    expect(signals.dislikedItemIds).toEqual(["one", "two"]);
  });

  test("items without embeddings cannot seed but are still known", () => {
    const signals = pickRatingSignals([
      row({ itemId: "ep", rating: 5, hasEmbedding: false, seriesId: "series" }),
    ]);
    expect(signals.likedItemIds).toEqual([]);
    expect(new Set(signals.knownItemIds)).toEqual(new Set(["ep", "series"]));
  });

  test("seeds are capped", () => {
    const rows = Array.from({ length: RATING_SEED_LIMIT + 10 }, (_, i) =>
      row({ itemId: `i${i}`, rating: 5 }),
    );
    expect(pickRatingSignals(rows).likedItemIds).toHaveLength(
      RATING_SEED_LIMIT,
    );
  });
});

describe("interleaveByType", () => {
  test("round-robins types so one kind cannot fill the seed cap", () => {
    const seeds = pickRatingSignals([
      row({ itemId: "m1", rating: 5, ratedAt: new Date("2026-05-01") }),
      row({ itemId: "m2", rating: 5, ratedAt: new Date("2026-04-01") }),
      row({ itemId: "m3", rating: 5, ratedAt: new Date("2026-03-01") }),
      row({
        itemId: "e1",
        type: "Episode",
        rating: 5,
        ratedAt: new Date("2025-12-01"),
      }),
      row({
        itemId: "e2",
        type: "Episode",
        rating: 4,
        ratedAt: new Date("2025-12-01"),
      }),
    ]);
    expect(seeds.likedItemIds).toEqual(["m1", "e1", "m2", "e2", "m3"]);
  });
});

describe("relativeSimilarity", () => {
  test("is relative to the seed's own best match", () => {
    expect(relativeSimilarity(0.55, 0.55)).toBe(1);
    expect(relativeSimilarity(0.44, 0.55)).toBeCloseTo(0.8);
    expect(relativeSimilarity(0.5, 0)).toBe(0);
  });

  test("makes a short-text episode seed comparable to a movie seed", () => {
    // Raw: the movie seed's 2nd match (0.70) outranks the episode's best (0.56).
    const movieSecond = relativeSimilarity(0.7, 0.85);
    const episodeBest = relativeSimilarity(0.56, 0.56);
    expect(episodeBest).toBeGreaterThan(movieSecond);
  });
});

describe("isNearerToDislike", () => {
  test("drops a candidate relatively closer to a dislike than to its seeds", () => {
    expect(isNearerToDislike([0.6, 0.7], 0.9)).toBe(true);
    expect(isNearerToDislike([0.6, 0.7], 0.65)).toBe(false);
    expect(isNearerToDislike([0.6], undefined)).toBe(false);
  });

  test("never drops a seed's own best match", () => {
    expect(isNearerToDislike([1, 0.4], 1)).toBe(false);
  });
});

describe("alternate", () => {
  test("keeps each list's order", () => {
    expect(alternate([1, 2, 3], ["a"])).toEqual([1, "a", 2, 3]);
    expect(alternate([], ["a", "b"])).toEqual(["a", "b"]);
  });
});
