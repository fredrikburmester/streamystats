/**
 * Pure scoring core of the recommendation engine.
 *
 * Everything in this module is side-effect free: it takes graph edges,
 * a user taste profile, and candidate metadata, and produces ranked,
 * diversified recommendations. All I/O (reading the graph, profiles,
 * exclusions) lives in `lib/db/recommendations.ts`.
 */

export type EdgeType = "co_watched" | "shared_people" | "embedding";

/**
 * How much each edge type contributes to the graph score. Collaborative
 * co-watch signals rank highest because they encode real viewing behaviour;
 * shared creative talent next; semantic similarity is the broadest signal.
 */
export const EDGE_TYPE_WEIGHTS: Record<EdgeType, number> = {
  co_watched: 1.0,
  shared_people: 0.85,
  embedding: 0.7,
};

/** Relative weight of each scoring component in the final blend. */
export const SCORE_WEIGHTS = {
  graph: 0.45,
  semantic: 0.3,
  genre: 0.13,
  decade: 0.06,
  rating: 0.06,
} as const;

export interface GraphEdge {
  sourceItemId: string;
  targetItemId: string;
  edgeType: string;
  weight: number;
}

export interface AnchorWeight {
  itemId: string;
  weight: number;
}

export interface EdgeContribution {
  anchorItemId: string;
  edgeType: EdgeType;
  contribution: number;
}

export interface GraphScore {
  targetItemId: string;
  score: number;
  contributions: EdgeContribution[];
}

function isEdgeType(value: string): value is EdgeType {
  return value in EDGE_TYPE_WEIGHTS;
}

/**
 * Aggregate raw graph edges into one score per target item.
 * Each edge contributes edgeWeight x anchorWeight x edgeTypeWeight, so a
 * candidate connected to several strong anchors via several edge types
 * accumulates evidence from all of them.
 */
export function aggregateGraphScores(
  edges: GraphEdge[],
  anchors: AnchorWeight[],
): Map<string, GraphScore> {
  const anchorWeights = new Map(anchors.map((a) => [a.itemId, a.weight]));
  const result = new Map<string, GraphScore>();

  for (const edge of edges) {
    if (!isEdgeType(edge.edgeType)) continue;
    const anchorWeight = anchorWeights.get(edge.sourceItemId);
    if (anchorWeight === undefined) continue;

    const contribution =
      edge.weight * anchorWeight * EDGE_TYPE_WEIGHTS[edge.edgeType];
    if (contribution <= 0) continue;

    let entry = result.get(edge.targetItemId);
    if (!entry) {
      entry = { targetItemId: edge.targetItemId, score: 0, contributions: [] };
      result.set(edge.targetItemId, entry);
    }
    entry.score += contribution;
    entry.contributions.push({
      anchorItemId: edge.sourceItemId,
      edgeType: edge.edgeType,
      contribution,
    });
  }

  for (const entry of result.values()) {
    entry.contributions.sort((a, b) => b.contribution - a.contribution);
  }
  return result;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Affinity of an item's genres to the user's genre weights (0..1).
 * Uses the strongest matching genre plus a small bonus for breadth so a
 * three-genre match beats a single-genre match of the same strength.
 */
export function genreAffinity(
  genres: string[] | null | undefined,
  genreWeights: Record<string, number> | null | undefined,
): number {
  if (!genres || genres.length === 0 || !genreWeights) return 0;
  let best = 0;
  let sum = 0;
  let matches = 0;
  for (const genre of genres) {
    const weight = genreWeights[genre];
    if (weight !== undefined) {
      best = Math.max(best, weight);
      sum += weight;
      matches++;
    }
  }
  if (matches === 0) return 0;
  const breadthBonus = Math.min(
    0.2,
    ((sum - best) / Math.max(1, matches - 1)) * 0.2,
  );
  return Math.min(1, best + breadthBonus);
}

export function decadeAffinity(
  productionYear: number | null | undefined,
  decadeWeights: Record<string, number> | null | undefined,
): number {
  if (!productionYear || !decadeWeights) return 0;
  const decade = `${Math.floor(productionYear / 10) * 10}s`;
  return decadeWeights[decade] ?? 0;
}

/**
 * How close an item's community rating is to what the user typically
 * watches. Items without a rating get a neutral 0.5.
 */
export function ratingAffinity(
  communityRating: number | null | undefined,
  userRatingAffinity: number | null | undefined,
): number {
  if (communityRating === null || communityRating === undefined) return 0.5;
  if (userRatingAffinity === null || userRatingAffinity === undefined)
    return 0.5;
  return Math.max(0, 1 - Math.abs(communityRating - userRatingAffinity) / 5);
}

export interface CandidateSignals {
  itemId: string;
  graphScore: number; // raw, will be normalized against the batch max
  semanticSimilarity: number; // 0..1 cosine to the user's taste embedding
  genres: string[] | null;
  productionYear: number | null;
  communityRating: number | null;
  contributions: EdgeContribution[];
}

export interface UserProfileSignals {
  genreWeights: Record<string, number> | null;
  decadeWeights: Record<string, number> | null;
  ratingAffinity: number | null;
}

export interface ScoredCandidate {
  itemId: string;
  score: number; // 0..1 blended score
  contributions: EdgeContribution[];
}

/**
 * Blend all signals into a final 0..1 score per candidate.
 * The graph component is normalized against the strongest candidate in the
 * batch so scores stay comparable across users and library sizes.
 */
export function scoreCandidates(
  candidates: CandidateSignals[],
  profile: UserProfileSignals,
): ScoredCandidate[] {
  const maxGraph = Math.max(...candidates.map((c) => c.graphScore), 0);

  return candidates.map((candidate) => {
    const graphNorm = maxGraph > 0 ? candidate.graphScore / maxGraph : 0;
    const score =
      SCORE_WEIGHTS.graph * graphNorm +
      SCORE_WEIGHTS.semantic * Math.max(0, candidate.semanticSimilarity) +
      SCORE_WEIGHTS.genre *
        genreAffinity(candidate.genres, profile.genreWeights) +
      SCORE_WEIGHTS.decade *
        decadeAffinity(candidate.productionYear, profile.decadeWeights) +
      SCORE_WEIGHTS.rating *
        ratingAffinity(candidate.communityRating, profile.ratingAffinity);

    return {
      itemId: candidate.itemId,
      score: Math.min(1, score),
      contributions: candidate.contributions,
    };
  });
}

/**
 * Greedy diversity re-rank: walk candidates in score order but cap how many
 * items share the same primary genre, so one dominant genre cannot fill the
 * whole row. Skipped items backfill at the end if the cap leaves room.
 */
export function diversify<T extends { score: number }>(
  candidates: T[],
  getPrimaryGenre: (candidate: T) => string | null,
  limit: number,
  maxPerGenre?: number,
): T[] {
  const cap = maxPerGenre ?? Math.max(2, Math.ceil(limit / 3));
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const picked: T[] = [];
  const skipped: T[] = [];
  const genreCounts = new Map<string, number>();

  for (const candidate of sorted) {
    if (picked.length >= limit) break;
    const genre = getPrimaryGenre(candidate);
    if (genre !== null) {
      const count = genreCounts.get(genre) ?? 0;
      if (count >= cap) {
        skipped.push(candidate);
        continue;
      }
      genreCounts.set(genre, count + 1);
    }
    picked.push(candidate);
  }

  for (const candidate of skipped) {
    if (picked.length >= limit) break;
    picked.push(candidate);
  }

  return picked;
}
