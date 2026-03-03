export interface RecommendationCardItem {
  id: string;
  name: string;
  type: string | null;
  productionYear: number | null;
  runtimeTicks: number | null;
  genres: string[] | null;
  communityRating: number | null;
  primaryImageTag: string | null;
  primaryImageThumbTag: string | null;
  primaryImageLogoTag: string | null;
  backdropImageTags: string[] | null;
  seriesId: string | null;
  seriesPrimaryImageTag: string | null;
  parentBackdropItemId: string | null;
  parentBackdropImageTags: string[] | null;
  parentThumbItemId: string | null;
  parentThumbImageTag: string | null;
}

export interface RecommendationResult {
  item: RecommendationCardItem;
  similarity: number;
  basedOn: RecommendationCardItem[]; // Always [] for profile-based, kept for API compat
}

export type RecommendationSource = "user" | "server" | "none";

export interface ProfileRecommendationsResponse {
  source: RecommendationSource;
  results: RecommendationResult[];
}

export type SeriesRecommendationItem = RecommendationResult;
export type RecommendationItem = RecommendationResult;
