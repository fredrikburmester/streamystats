/**
 * Shared utilities for recommendation similarity scoring.
 *
 * Centralised here so that both the series and movie recommendation flows
 * stay consistent and future tuning only requires a change in one place.
 *
 * Note: this module assumes cosine similarities are non-negative (i.e. in the
 * range [0, 1]). This holds for the VectorChord `1 - cosine_distance()`
 * formulation used throughout the recommendation queries. MIN_SIMILARITY_THRESHOLD
 * and the weighting logic both rely on this assumption — negative similarities
 * would produce incorrect filtering and scoring behaviour.
 */

/**
 * Minimum cosine similarity a candidate item must reach against at least one
 * base item to be included in the recommendation pool.
 *
 * The previous value of 0.1 was too permissive: it admitted nearly all
 * unwatched content, feeding noisy low-similarity scores into the aggregation
 * step and dragging final scores down.
 *
 * Assumes non-negative cosine similarities — see module note above.
 */
export const MIN_SIMILARITY_THRESHOLD = 0.3;

/**
 * Raw weight applied to the maximum per-base-item similarity score.
 * Preserves the strongest individual genre-match signal.
 *
 * Normalized together with RAW_AVG_SIMILARITY_WEIGHT so that the exported
 * MAX_SIMILARITY_WEIGHT and AVG_SIMILARITY_WEIGHT always sum to 1, keeping
 * scoring stable if either value is adjusted.
 */
const RAW_MAX_SIMILARITY_WEIGHT = 0.7;

/**
 * Raw weight applied to the mean per-base-item similarity score.
 * Gives a small breadth bonus to candidates that match multiple base items.
 *
 * Normalized together with RAW_MAX_SIMILARITY_WEIGHT so that the exported
 * MAX_SIMILARITY_WEIGHT and AVG_SIMILARITY_WEIGHT always sum to 1, keeping
 * scoring stable if either value is adjusted.
 */
const RAW_AVG_SIMILARITY_WEIGHT = 0.3;

const RAW_SIMILARITY_WEIGHT_TOTAL =
  RAW_MAX_SIMILARITY_WEIGHT + RAW_AVG_SIMILARITY_WEIGHT;

/**
 * Normalized weight for the maximum score component. Guaranteed to sum to 1
 * with AVG_SIMILARITY_WEIGHT regardless of the raw values above.
 */
export const MAX_SIMILARITY_WEIGHT =
  RAW_MAX_SIMILARITY_WEIGHT / RAW_SIMILARITY_WEIGHT_TOTAL;

/**
 * Normalized weight for the mean score component. Guaranteed to sum to 1
 * with MAX_SIMILARITY_WEIGHT regardless of the raw values above.
 */
export const AVG_SIMILARITY_WEIGHT =
  RAW_AVG_SIMILARITY_WEIGHT / RAW_SIMILARITY_WEIGHT_TOTAL;

// Validated lazily on first call so that importing this module never throws
// during build, tests, or scripts — even if weights are misconfigured.
let weightsValidated = false;

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
 *
 * The formula is applied consistently for all input lengths — including a
 * single similarity score — so that results are directly comparable across
 * candidates regardless of how many base items they matched.
 */
export function weightedSimilarity(similarities: number[]): number {
  if (!weightsValidated) {
    weightsValidated = true;
    if (
      process.env.NODE_ENV !== "production" &&
      RAW_SIMILARITY_WEIGHT_TOTAL <= 0
    ) {
      console.warn(
        "[recommendation-utils] Similarity weights must sum to a positive value: " +
          `RAW_MAX_SIMILARITY_WEIGHT=${RAW_MAX_SIMILARITY_WEIGHT}, ` +
          `RAW_AVG_SIMILARITY_WEIGHT=${RAW_AVG_SIMILARITY_WEIGHT}`,
      );
    }
  }
  if (similarities.length === 0) return 0;
  const max = Math.max(...similarities);
  const avg = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  return max * MAX_SIMILARITY_WEIGHT + avg * AVG_SIMILARITY_WEIGHT;
}
