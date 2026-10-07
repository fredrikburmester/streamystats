/** Ratings are on a 0-5 scale; 4+ is "liked", 2 and below is "disliked". */
export const LIKED_MIN_RATING = 4;
export const DISLIKED_MAX_RATING = 2;
/**
 * Each seed is one nearest-neighbour query. Enough to cover a broad taste
 * without the recommendation pass growing with every rating someone adds.
 */
export const RATING_SEED_LIMIT = 40;

export interface RatingRow {
  itemId: string;
  rating: number;
  ratedAt: Date | null;
  seriesId: string | null;
  hasEmbedding: boolean;
}

export interface RatingSignals {
  /** Liked items with embeddings, strongest and most recent first. */
  likedItemIds: string[];
  /** Disliked items with embeddings, most strongly disliked first. */
  dislikedItemIds: string[];
  /**
   * Everything the user has rated plus the series of rated episodes: already
   * known to them, so never a recommendation.
   */
  knownItemIds: string[];
}

function byStrength(direction: 1 | -1) {
  return (a: RatingRow, b: RatingRow): number => {
    if (a.rating !== b.rating) return direction * (b.rating - a.rating);
    return (b.ratedAt?.getTime() ?? 0) - (a.ratedAt?.getTime() ?? 0);
  };
}

export function pickRatingSignals(rows: RatingRow[]): RatingSignals {
  const known = new Set<string>();
  for (const row of rows) {
    known.add(row.itemId);
    if (row.seriesId) known.add(row.seriesId);
  }
  const liked = rows
    .filter((r) => r.hasEmbedding && r.rating >= LIKED_MIN_RATING)
    .sort(byStrength(1))
    .slice(0, RATING_SEED_LIMIT)
    .map((r) => r.itemId);
  const disliked = rows
    .filter((r) => r.hasEmbedding && r.rating <= DISLIKED_MAX_RATING)
    .sort(byStrength(-1))
    .slice(0, RATING_SEED_LIMIT)
    .map((r) => r.itemId);
  return {
    likedItemIds: liked,
    dislikedItemIds: disliked,
    knownItemIds: [...known],
  };
}

/**
 * A candidate's similarity relative to its seed's own nearest neighbour.
 * Raw cosine similarity is not comparable across seeds: an episode embedded
 * from a short overview scores lower against everything than a movie with
 * full metadata does. Relative to each seed's best match, every seed's
 * strongest pick is 1 and the rest fall off from there.
 */
export function relativeSimilarity(
  similarity: number,
  topSimilarity: number,
): number {
  if (!(topSimilarity > 0)) return 0;
  return Math.min(1, similarity / topSimilarity);
}

/**
 * A candidate is dropped when it is relatively closer to something the user
 * disliked than to anything that led to it being suggested. A seed's own best
 * match (relevance 1) is never dropped.
 */
export function isNearerToDislike(
  seedRelevances: number[],
  dislikeRelevance: number | undefined,
): boolean {
  if (dislikeRelevance === undefined || seedRelevances.length === 0) {
    return false;
  }
  return dislikeRelevance > Math.max(...seedRelevances);
}
