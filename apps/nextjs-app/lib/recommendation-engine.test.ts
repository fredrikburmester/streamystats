import { describe, expect, test } from "bun:test";
import {
  aggregateGraphScores,
  cosineSimilarity,
  decadeAffinity,
  diversify,
  EDGE_TYPE_WEIGHTS,
  genreAffinity,
  ratingAffinity,
  scoreCandidates,
} from "./recommendation-engine";

describe("aggregateGraphScores", () => {
  const anchors = [
    { itemId: "a1", weight: 1.0 },
    { itemId: "a2", weight: 0.5 },
  ];

  test("sums contributions from multiple anchors and edge types", () => {
    const edges = [
      {
        sourceItemId: "a1",
        targetItemId: "t1",
        edgeType: "co_watched",
        weight: 0.8,
      },
      {
        sourceItemId: "a2",
        targetItemId: "t1",
        edgeType: "embedding",
        weight: 0.6,
      },
      {
        sourceItemId: "a1",
        targetItemId: "t2",
        edgeType: "shared_people",
        weight: 0.5,
      },
    ];
    const scores = aggregateGraphScores(edges, anchors);

    const t1 = scores.get("t1");
    expect(t1).toBeDefined();
    expect(t1?.score).toBeCloseTo(
      0.8 * 1.0 * EDGE_TYPE_WEIGHTS.co_watched +
        0.6 * 0.5 * EDGE_TYPE_WEIGHTS.embedding,
    );
    expect(t1?.contributions).toHaveLength(2);
    // Contributions sorted strongest-first
    expect(t1?.contributions[0].anchorItemId).toBe("a1");

    expect(scores.get("t2")?.score).toBeCloseTo(
      0.5 * 1.0 * EDGE_TYPE_WEIGHTS.shared_people,
    );
  });

  test("ignores edges from unknown anchors and unknown edge types", () => {
    const edges = [
      {
        sourceItemId: "zz",
        targetItemId: "t1",
        edgeType: "co_watched",
        weight: 0.9,
      },
      {
        sourceItemId: "a1",
        targetItemId: "t1",
        edgeType: "mystery",
        weight: 0.9,
      },
    ];
    expect(aggregateGraphScores(edges, anchors).size).toBe(0);
  });
});

describe("cosineSimilarity", () => {
  test("identical vectors are 1, orthogonal are 0", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  test("mismatched lengths and zero vectors return 0", () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("genreAffinity", () => {
  const weights = { Drama: 1.0, Thriller: 0.6, Comedy: 0.2 };

  test("uses strongest matching genre with breadth bonus", () => {
    const single = genreAffinity(["Drama"], weights);
    const multi = genreAffinity(["Drama", "Thriller"], weights);
    expect(single).toBeCloseTo(1.0);
    expect(multi).toBeGreaterThanOrEqual(single);
  });

  test("returns 0 for no genres or no profile", () => {
    expect(genreAffinity([], weights)).toBe(0);
    expect(genreAffinity(["SciFi"], weights)).toBe(0);
    expect(genreAffinity(["Drama"], null)).toBe(0);
  });
});

describe("decadeAffinity", () => {
  test("maps year to decade bucket", () => {
    expect(decadeAffinity(1994, { "1990s": 0.8 })).toBe(0.8);
    expect(decadeAffinity(2003, { "1990s": 0.8 })).toBe(0);
    expect(decadeAffinity(null, { "1990s": 0.8 })).toBe(0);
  });
});

describe("ratingAffinity", () => {
  test("closer ratings score higher, missing data is neutral", () => {
    expect(ratingAffinity(8, 8)).toBe(1);
    expect(ratingAffinity(3, 8)).toBe(0);
    expect(ratingAffinity(null, 8)).toBe(0.5);
    expect(ratingAffinity(8, null)).toBe(0.5);
  });
});

describe("scoreCandidates", () => {
  const profile = {
    genreWeights: { Drama: 1.0 },
    decadeWeights: { "2010s": 1.0 },
    ratingAffinity: 8,
  };

  test("normalizes graph scores against the batch max", () => {
    const scored = scoreCandidates(
      [
        {
          itemId: "strong",
          graphScore: 2.0,
          semanticSimilarity: 0.9,
          genres: ["Drama"],
          productionYear: 2015,
          communityRating: 8,
          contributions: [],
        },
        {
          itemId: "weak",
          graphScore: 0.5,
          semanticSimilarity: 0.1,
          genres: null,
          productionYear: null,
          communityRating: null,
          contributions: [],
        },
      ],
      profile,
    );

    const strong = scored.find((s) => s.itemId === "strong");
    const weak = scored.find((s) => s.itemId === "weak");
    expect(strong).toBeDefined();
    expect(weak).toBeDefined();
    if (!strong || !weak) return;
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(1);
    // Perfect signals across the board approach 1
    expect(strong.score).toBeGreaterThan(0.9);
  });

  test("handles an all-zero graph batch without dividing by zero", () => {
    const scored = scoreCandidates(
      [
        {
          itemId: "x",
          graphScore: 0,
          semanticSimilarity: 0.5,
          genres: null,
          productionYear: null,
          communityRating: null,
          contributions: [],
        },
      ],
      profile,
    );
    expect(Number.isFinite(scored[0].score)).toBe(true);
  });
});

describe("diversify", () => {
  const make = (id: string, score: number, genre: string | null) => ({
    id,
    score,
    genre,
  });

  test("caps items per primary genre and backfills with skipped items", () => {
    const candidates = [
      make("d1", 0.9, "Drama"),
      make("d2", 0.85, "Drama"),
      make("d3", 0.8, "Drama"),
      make("d4", 0.75, "Drama"),
      make("c1", 0.5, "Comedy"),
      make("s1", 0.4, "SciFi"),
    ];

    const picked = diversify(candidates, (c) => c.genre, 4, 2);
    const ids = picked.map((p) => p.id);
    // Top two dramas kept, then other genres, then backfilled drama
    expect(ids.slice(0, 2)).toEqual(["d1", "d2"]);
    expect(ids).toContain("c1");
    expect(ids).toContain("s1");
    expect(ids).toHaveLength(4);
  });

  test("respects the overall limit", () => {
    const candidates = [
      make("a", 0.9, "A"),
      make("b", 0.8, "B"),
      make("c", 0.7, "C"),
    ];
    expect(diversify(candidates, (c) => c.genre, 2)).toHaveLength(2);
  });
});
