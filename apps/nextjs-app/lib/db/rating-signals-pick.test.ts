import { describe, expect, test } from "bun:test";
import {
  isNearerToDislike,
  pickRatingSignals,
  RATING_SEED_LIMIT,
  type RatingRow,
} from "./rating-signals-pick";

const row = (
  overrides: Partial<RatingRow> & { itemId: string },
): RatingRow => ({
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

describe("isNearerToDislike", () => {
  test("drops a candidate at least as close to a dislike as to its seeds", () => {
    expect(isNearerToDislike([0.6, 0.7], 0.7)).toBe(true);
    expect(isNearerToDislike([0.6, 0.7], 0.65)).toBe(false);
    expect(isNearerToDislike([0.6], undefined)).toBe(false);
  });
});
