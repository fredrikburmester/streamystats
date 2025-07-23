import { db, jellyseerrItems, JellyseerrItem } from "@streamystats/database";
import { eq, desc, and } from "drizzle-orm";

export interface JellyseerrPopularMovie {
  id: string;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  releaseDate: string | null;
  productionYear: number | null;
  type: string;
  communityRating: number | null;
  popularity: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[] | null;
  sourceType: string;
  mediaType: string;
}

export const getJellyseerrPopularMovies = async (
  serverId: string | number,
  limit: number = 200
): Promise<JellyseerrPopularMovie[]> => {
  try {
    const serverIdNum = Number(serverId);

    const popularMovies = await db
      .select()
      .from(jellyseerrItems)
      .where(
        and(
          eq(jellyseerrItems.serverId, serverIdNum),
          eq(jellyseerrItems.processed, true) // Only get items with embeddings
        )
      )
      .orderBy(
        desc(jellyseerrItems.popularity),
        desc(jellyseerrItems.communityRating)
      )
      .limit(limit);

    return popularMovies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      originalTitle: movie.originalTitle,
      overview: movie.overview,
      releaseDate: movie.releaseDate,
      productionYear: movie.productionYear,
      type: movie.type,
      communityRating: movie.communityRating,
      popularity: movie.popularity,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      genres: movie.genres as string[] | null,
      sourceType: movie.sourceType,
      mediaType: movie.mediaType,
    }));
  } catch (error) {
    console.error("Error fetching Jellyseerr popular movies:", error);
    return [];
  }
};

export const getJellyseerrTrendingMovies = async (
  serverId: string | number,
  limit: number = 200
): Promise<JellyseerrPopularMovie[]> => {
  try {
    const serverIdNum = Number(serverId);

    const trendingMovies = await db
      .select()
      .from(jellyseerrItems)
      .where(
        and(
          eq(jellyseerrItems.serverId, serverIdNum),
          eq(jellyseerrItems.sourceType, "trending"),
          eq(jellyseerrItems.processed, true)
        )
      )
      .orderBy(
        desc(jellyseerrItems.popularity),
        desc(jellyseerrItems.communityRating)
      )
      .limit(limit);

    return trendingMovies.map((movie) => ({
      id: movie.id,
      title: movie.title,
      originalTitle: movie.originalTitle,
      overview: movie.overview,
      releaseDate: movie.releaseDate,
      productionYear: movie.productionYear,
      type: movie.type,
      communityRating: movie.communityRating,
      popularity: movie.popularity,
      posterPath: movie.posterPath,
      backdropPath: movie.backdropPath,
      genres: movie.genres as string[] | null,
      sourceType: movie.sourceType,
      mediaType: movie.mediaType,
    }));
  } catch (error) {
    console.error("Error fetching Jellyseerr trending movies:", error);
    return [];
  }
};
