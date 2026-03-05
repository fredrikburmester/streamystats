/**
 * Shared utilities for recommendation similarity scoring.
 *
 * Centralised here so that both the series and movie recommendation flows
 * stay consistent and future tuning only requires a change in one place.
 */

/**
 * Minimum cosine similarity a candidate item must reach against at least one
 * base item to be included in the recommendation pool.
 *
 * The previous value of 0.1 was too permissive: it admitted nearly all
 * unwatched content, feeding noisy low-similarity scores into the aggregation
 * step and dragging final scores down.
 */
export const MIN_SIMILARITY_THRESHOLD = 0.3;

/**
 * Weight applied to the maximum per-base-item similarity score.
 * Preserves the strongest individual genre-match signal.
 */
export const MAX_SIMILARITY_WEIGHT = 0.7;

/**
 * Weight applied to the mean per-base-item similarity score.
 * Gives a small breadth bonus to candidates that match multiple base items.
 */
export const AVG_SIMILARITY_WEIGHT = 0.3;

/**
 * Compute a weighted similarity score from multiple per-base-item scores.
 *
 * Plain averaging penalises niche content: a series that is a great match for
 * one watched anime title will have its score dragged down by low similarity
 * to unrelated genres (crime, medical, etc.) also present in the base list.
 *
 * Max-weighted pooling preserves the strongest signal (the best individual
 * match) while giving a small bonus to candidates that appear across many of
 * the user's watched items (breadth bonus).
 *
 *   score = MAX_SIMILARITY_WEIGHT × max + AVG_SIMILARITY_WEIGHT × mean
 *         = 0.7 × max + 0.3 × mean
 *
 * This keeps niche recommendations visible while still surfacing cross-genre
 * hits when they genuinely overlap with multiple parts of the user's history.
 */
export function weightedSimilarity(similarities: number[]): number {
  if (similarities.length === 0) return 0;
  if (similarities.length === 1) return similarities[0];
  const max = Math.max(...similarities);
  const avg =
    similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  return max * MAX_SIMILARITY_WEIGHT + avg * AVG_SIMILARITY_WEIGHT;
}
