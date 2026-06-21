import type { ImageBlurHashes } from "@streamystats/database/schema";

export type RecommendationCardItem = {
  id?: string | null;
  name?: string | null;
  type?: string | null;
  productionYear?: number | null;
  runtimeTicks?: number | null;
  genres?: string[] | null;

  primaryImageTag?: string | null;
  primaryImageThumbTag?: string | null;
  primaryImageLogoTag?: string | null;

  backdropImageTags?: string[] | null;

  seriesId?: string | null;
  seriesPrimaryImageTag?: string | null;

  parentBackdropItemId?: string | null;
  parentBackdropImageTags?: string[] | null;

  parentThumbItemId?: string | null;
  parentThumbImageTag?: string | null;

  imageBlurHashes?: ImageBlurHashes | null;
};

export type RecommendationListItem = {
  item: RecommendationCardItem;
  similarity: number;
  basedOn?: RecommendationCardItem[];
};
