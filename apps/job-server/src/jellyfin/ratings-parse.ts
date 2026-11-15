export interface OpinionUserData {
  IsFavorite: boolean;
  /** true = thumbs up, false = thumbs down, null = no opinion */
  Likes: boolean | null;
}

export interface JellyfinOpinionItem {
  Id: string;
  UserData: OpinionUserData;
}

export interface JellyfinEnhancedReview {
  userId: string;
  mediaType: "movie" | "tv";
  /** "603", "1418", "1418:s4" or "1418:s4:e12" */
  tmdbId: string;
  rating: number;
  content: string | null;
  updatedAt: string | null;
}

/** Where a Jellyfin Enhanced review points, by TMDB id. */
export type ReviewTarget =
  | { kind: "movie"; tmdbId: string }
  | { kind: "series"; tmdbId: string }
  | { kind: "season"; seriesTmdbId: string; season: number }
  | { kind: "episode"; seriesTmdbId: string; season: number; episode: number };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseOpinionUserData(raw: unknown): OpinionUserData | null {
  if (!isRecord(raw)) return null;
  const isFavorite = raw.IsFavorite === true;
  const likes = typeof raw.Likes === "boolean" ? raw.Likes : null;
  if (!isFavorite && likes === null) return null;
  return { IsFavorite: isFavorite, Likes: likes };
}

/** The /Items filters that select items a user has an opinion on. */
export const OPINION_FILTERS = ["IsFavorite", "Likes", "Dislikes"] as const;
export type OpinionFilter = (typeof OPINION_FILTERS)[number];

/**
 * Whether an item really belongs in a filter's results. Jellyfin versions
 * disagree on what these filters return (on 12.0 `Dislikes` returns every
 * item that is not liked), so results are checked rather than trusted.
 */
export function matchesOpinionFilter(
  filter: OpinionFilter,
  userData: OpinionUserData | null,
): boolean {
  if (!userData) return false;
  if (filter === "IsFavorite") return userData.IsFavorite;
  if (filter === "Likes") return userData.Likes === true;
  return userData.Likes === false;
}

/**
 * Jellyfin's native opinions on the 0-5 scale ratings use. A favorite is the
 * strongest signal Jellyfin offers; a thumbs-down maps low enough to steer
 * recommendations away without being treated as worse than a 1-star review.
 */
export function opinionToRating(userData: OpinionUserData): number {
  if (userData.IsFavorite) return 5;
  if (userData.Likes === true) return 4;
  return 1;
}

export function parseJellyfinEnhancedReviewPage(
  raw: unknown
): {
  reviews: JellyfinEnhancedReview[];
  /** Entries on the page before filtering, which is what pagination counts. */
  pageSize: number;
  total: number;
} | null {
  if (!isRecord(raw) || !Array.isArray(raw.reviews)) return null;
  const total = typeof raw.total === "number" ? raw.total : raw.reviews.length;
  const reviews: JellyfinEnhancedReview[] = [];
  for (const entry of raw.reviews) {
    if (!isRecord(entry)) continue;
    const { userId, mediaType, tmdbId, rating, content, updatedAt } = entry;
    // A text-only review (null rating) carries no score to learn from; the
    // plugin only accepts ratings from 1 to 5.
    if (typeof rating !== "number" || !Number.isFinite(rating) || rating <= 0) continue;
    if (typeof userId !== "string" || typeof tmdbId !== "string") continue;
    if (mediaType !== "movie" && mediaType !== "tv") continue;
    reviews.push({
      userId,
      mediaType,
      tmdbId,
      rating: Math.min(5, rating),
      content: typeof content === "string" && content.trim().length > 0 ? content : null,
      updatedAt: typeof updatedAt === "string" ? updatedAt : null,
    });
  }
  return { reviews, pageSize: raw.reviews.length, total };
}

const NUMERIC = /^\d+$/;

export function parseReviewTarget(
  mediaType: "movie" | "tv",
  tmdbId: string
): ReviewTarget | null {
  const [id, seasonPart, episodePart, ...rest] = tmdbId.split(":");
  if (!id || !NUMERIC.test(id) || rest.length > 0) return null;
  if (mediaType === "movie") {
    return seasonPart === undefined ? { kind: "movie", tmdbId: id } : null;
  }
  if (seasonPart === undefined) return { kind: "series", tmdbId: id };
  const season = /^s(\d+)$/.exec(seasonPart);
  if (!season) return null;
  const seasonNumber = Number.parseInt(season[1], 10);
  if (episodePart === undefined) {
    return { kind: "season", seriesTmdbId: id, season: seasonNumber };
  }
  const episode = /^e(\d+)$/.exec(episodePart);
  if (!episode) return null;
  return {
    kind: "episode",
    seriesTmdbId: id,
    season: seasonNumber,
    episode: Number.parseInt(episode[1], 10),
  };
}
