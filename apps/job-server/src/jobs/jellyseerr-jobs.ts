import {
  db,
  servers,
  jellyseerrItems,
  NewJellyseerrItem,
} from "@streamystats/database";
import { eq } from "drizzle-orm";
import { logJobResult } from "./job-logger";
import { getJobQueue } from "./queue";

// TMDB Genre ID to Name mapping (covers both movies and TV shows)
// These mappings are based on TMDB's official genre lists
// TODO: Consider fetching dynamically from TMDB API endpoints:
//   - Movies: https://api.themoviedb.org/3/genre/movie/list
//   - TV: https://api.themoviedb.org/3/genre/tv/list
// Source verification: https://www.themoviedb.org/genre/{id}-{name}/movie
const TMDB_GENRE_MAP: Record<number, string> = {
  // Shared genres (movies and TV)
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  53: "Thriller",
  10752: "War",
  37: "Western",

  // Movie-specific genres
  28: "Action",
  10770: "TV Movie",

  // TV-specific genres
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",

  // Additional common genres that might appear
  10754: "Neo-noir",
  1115: "Surreal",
  10756: "Experimental",
};

// Helper function to convert genre IDs to genre names
function convertGenreIdsToNames(genreIds: number[]): string[] {
  const genreNames: string[] = [];
  const unknownIds: number[] = [];

  genreIds.forEach((id) => {
    const genreName = TMDB_GENRE_MAP[id];
    if (genreName) {
      genreNames.push(genreName);
    } else {
      unknownIds.push(id);
      // Keep unknown IDs with a descriptive fallback
      genreNames.push(`Unknown Genre (${id})`);
    }
  });

  // Log unknown genre IDs for debugging/improvement
  if (unknownIds.length > 0) {
    console.warn(`🚨 Unknown TMDB genre IDs found: [${unknownIds.join(", ")}]`);
    console.warn(
      `   Consider adding these to TMDB_GENRE_MAP or fetching from TMDB API`
    );
  }

  // Remove duplicates
  return genreNames.filter((name, index, arr) => arr.indexOf(name) === index);
}

// TODO: Future enhancement - fetch genres dynamically from TMDB API
// async function fetchTmdbGenres(): Promise<Record<number, string>> {
//   const [movieGenres, tvGenres] = await Promise.all([
//     fetch('https://api.themoviedb.org/3/genre/movie/list?api_key=YOUR_KEY').then(r => r.json()),
//     fetch('https://api.themoviedb.org/3/genre/tv/list?api_key=YOUR_KEY').then(r => r.json())
//   ]);
//
//   const genreMap: Record<number, string> = {};
//   [...movieGenres.genres, ...tvGenres.genres].forEach(genre => {
//     genreMap[genre.id] = genre.name;
//   });
//   return genreMap;
// }

// Jellyseerr types (we'll copy the essential ones to avoid circular imports)
interface JellyseerrMovie {
  id: number;
  // Movie properties
  title?: string;
  originalTitle?: string;
  releaseDate?: string;
  // TV show properties (some items might be TV shows from trending endpoint)
  name?: string;
  originalName?: string;
  firstAirDate?: string;
  // Common properties
  overview?: string;
  posterPath?: string;
  backdropPath?: string;
  genreIds?: number[];
  voteAverage?: number;
  popularity?: number;
  adult?: boolean;
  originalLanguage?: string;
  video?: boolean;
  voteCount?: number;
  mediaType?: "movie" | "tv";
}

class JellyseerrClient {
  private baseUrl: string;
  private apiKey: string | null;
  private cookies: string[];
  private xsrfToken: string | null;

  constructor(baseUrl: string, sessionCookies: string[] = []) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.cookies = sessionCookies;
    this.apiKey = null; // We use cookies, not API keys
    // Extract XSRF token from cookies
    this.xsrfToken = this.extractXsrfToken(sessionCookies);
  }

  private extractXsrfToken(cookies: string[]): string | null {
    const xsrfCookie = cookies.find((cookie) => cookie.includes("XSRF-TOKEN="));
    if (xsrfCookie) {
      const match = xsrfCookie.match(/XSRF-TOKEN=([^;]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}/api/v1${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add session cookies for authentication
    if (this.cookies.length > 0) {
      headers.Cookie = this.cookies
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
    }

    // Add XSRF token for CSRF protection
    if (this.xsrfToken) {
      headers["XSRF-TOKEN"] = this.xsrfToken;
    }

    // DEBUG: Log request details
    console.log(`🔍 Jellyseerr API Request:`, {
      url,
      method: options.method || "GET",
      authType: this.apiKey
        ? "API_KEY"
        : this.cookies?.length
        ? "COOKIES"
        : "NONE",
      hasApiKey: !!this.apiKey,
      apiKeyPreview:
        this.apiKey && typeof this.apiKey === "string"
          ? `${this.apiKey.substring(0, 8)}...`
          : "none",
      hasCookies: !!this.cookies?.length,
      cookieCount: this.cookies?.length || 0,
      hasXsrfToken: !!this.xsrfToken,
      headers: Object.keys(headers),
    });

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Important for cookie-based auth
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    // DEBUG: Log response details
    console.log(`📡 Jellyseerr API Response:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      // Try to get error details from response body
      let errorBody = "";
      try {
        errorBody = await response.text();
        console.log(`❌ Jellyseerr API Error Body:`, errorBody);
      } catch (e) {
        console.log(`❌ Could not read error response body`);
      }

      throw new Error(
        `Jellyseerr API error: ${response.status} ${response.statusText}${
          errorBody ? ` - ${errorBody}` : ""
        }`
      );
    }

    return response.json();
  }

  async getPopularMovies(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrMovie[];
  }> {
    // Use the correct Jellyseerr discover endpoint for popular movies
    return (await this.fetch(`/discover/movies?page=${page}`)) as {
      page: number;
      totalPages: number;
      totalResults: number;
      results: JellyseerrMovie[];
    };
  }

  async getTrendingMovies(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrMovie[];
  }> {
    // Use the correct Jellyseerr discover endpoint for trending movies
    return (await this.fetch(`/discover/trending?page=${page}`)) as {
      page: number;
      totalPages: number;
      totalResults: number;
      results: JellyseerrMovie[];
    };
  }

  async getUpcomingMovies(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrMovie[];
  }> {
    // Get upcoming movies with release date filter
    const today = new Date().toISOString().split("T")[0];
    return (await this.fetch(
      `/discover/movies?page=${page}&primaryReleaseDateGte=${today}`
    )) as {
      page: number;
      totalPages: number;
      totalResults: number;
      results: JellyseerrMovie[];
    };
  }
}

// Job: Sync popular movies from Jellyseerr and store them for embedding generation
export async function syncJellyseerrPopularMoviesJob(job: any) {
  const startTime = Date.now();
  const { serverId, userCredentials } = job.data;

  try {
    console.log(`🎬 Starting Jellyseerr movies sync for server ${serverId}`);

    // Get server configuration
    const serverData = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!serverData.length) {
      throw new Error(`Server ${serverId} not found`);
    }

    const server = serverData[0];

    // DEBUG: Log server configuration
    console.log(`🔧 Jellyseerr Server Config:`, {
      serverId: server.id,
      serverName: server.name,
      jellyseerrUrl: server.jellyseerrUrl,
      enableJellyseerrIntegration: server.enableJellyseerrIntegration,
      hasJellyseerrUrl: !!server.jellyseerrUrl,
    });

    if (!server.enableJellyseerrIntegration || !server.jellyseerrUrl) {
      throw new Error("Jellyseerr integration not properly configured");
    }

    // Create Jellyseerr client with user credentials if available
    let jellyseerrClient: JellyseerrClient;

    if (userCredentials && userCredentials.cookies) {
      console.log(`🍪 Using user session cookies for authentication`);
      jellyseerrClient = new JellyseerrClient(
        server.jellyseerrUrl,
        userCredentials.cookies
      );
    } else {
      console.log(
        `⚠️  No user credentials available, trying without authentication`
      );
      jellyseerrClient = new JellyseerrClient(server.jellyseerrUrl);
    }

    console.log(
      `🎬 Created Jellyseerr client for URL: ${server.jellyseerrUrl}`
    );

    let syncedCount = 0;
    let errorCount = 0;
    const seenMovieIds = new Set<string>();

    // Fetch popular movies (first 3 pages to get ~60 movies)
    const pagesToFetch = 3;
    for (let page = 1; page <= pagesToFetch; page++) {
      try {
        console.log(`📋 Fetching popular movies page ${page} from Jellyseerr`);
        const popularMovies = await jellyseerrClient.getPopularMovies(page);

        for (const movie of popularMovies.results) {
          const itemId = `jellyseerr-movie-${movie.id}`;

          if (seenMovieIds.has(itemId)) {
            continue; // Skip duplicates
          }
          seenMovieIds.add(itemId);

          try {
            // Convert Jellyseerr movie to jellyseerr_items format
            // Handle both movies and TV shows that might come from trending/popular endpoints
            const title =
              movie.title ||
              movie.name ||
              movie.originalTitle ||
              movie.originalName ||
              `Unknown Title (${movie.id})`;
            const releaseDate = movie.releaseDate || movie.firstAirDate || null;
            const itemType = movie.title
              ? "Movie"
              : movie.name
              ? "TV"
              : "Movie"; // Default to Movie if unclear

            // Debug log for mixed content and genre conversion
            if (!movie.title && movie.name) {
              console.log(
                `📺 Processing TV show from popular endpoint: ${title} (${movie.id})`
              );
            }

            if (movie.genreIds && movie.genreIds.length > 0) {
              const genreNames = convertGenreIdsToNames(movie.genreIds);
              console.log(
                `🎭 Genres for "${title}": [${movie.genreIds.join(
                  ", "
                )}] → ["${genreNames.join('", "')}"]`
              );
            }

            const jellyseerrItemData: NewJellyseerrItem = {
              id: itemId,
              serverId: server.id,
              tmdbId: movie.id,
              title: title,
              originalTitle: movie.originalTitle || movie.originalName || null,
              overview: movie.overview || null,
              releaseDate: releaseDate,
              productionYear: releaseDate
                ? new Date(releaseDate).getFullYear()
                : null,
              type: itemType,
              communityRating: movie.voteAverage || null,
              popularity: movie.popularity || null,
              voteCount: movie.voteCount || null,
              posterPath: movie.posterPath || null,
              backdropPath: movie.backdropPath || null,
              originalLanguage: movie.originalLanguage || null,
              adult: movie.adult || false,
              genres: movie.genreIds
                ? convertGenreIdsToNames(movie.genreIds)
                : null,
              sourceType: "popular",
              mediaType: movie.title ? "movie" : movie.name ? "tv" : "movie",
              processed: false, // Will be processed by embeddings job
              embedding: null,
              rawData: movie,
            };

            // Insert or update the item
            await db
              .insert(jellyseerrItems)
              .values(jellyseerrItemData)
              .onConflictDoUpdate({
                target: jellyseerrItems.id,
                set: {
                  title: jellyseerrItemData.title,
                  originalTitle: jellyseerrItemData.originalTitle,
                  overview: jellyseerrItemData.overview,
                  communityRating: jellyseerrItemData.communityRating,
                  popularity: jellyseerrItemData.popularity,
                  voteCount: jellyseerrItemData.voteCount,
                  genres: jellyseerrItemData.genres,
                  processed: false, // Reset processed status to re-generate embeddings
                  rawData: jellyseerrItemData.rawData,
                  updatedAt: new Date(),
                },
              });

            syncedCount++;
          } catch (itemError) {
            console.error(
              `Error syncing movie ${movie.title} (${movie.id}):`,
              itemError
            );
            errorCount++;
            continue;
          }
        }

        // Small delay between pages
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (pageError) {
        console.error(`Error fetching popular movies page ${page}:`, pageError);
        errorCount++;
        continue;
      }
    }

    // Also fetch trending movies
    try {
      console.log("📋 Fetching trending movies from Jellyseerr");
      const trendingMovies = await jellyseerrClient.getTrendingMovies(1);

      for (const movie of trendingMovies.results.slice(0, 20)) {
        const itemId = `jellyseerr-movie-${movie.id}`;

        if (seenMovieIds.has(itemId)) {
          continue; // Skip duplicates
        }
        seenMovieIds.add(itemId);

        try {
          // Handle both movies and TV shows that might come from trending endpoint
          const title =
            movie.title ||
            movie.name ||
            movie.originalTitle ||
            movie.originalName ||
            `Unknown Title (${movie.id})`;
          const releaseDate = movie.releaseDate || movie.firstAirDate || null;
          const itemType = movie.title ? "Movie" : movie.name ? "TV" : "Movie"; // Default to Movie if unclear

          // Debug log for mixed content and genre conversion
          if (!movie.title && movie.name) {
            console.log(
              `📺 Processing TV show from trending endpoint: ${title} (${movie.id})`
            );
          }

          if (movie.genreIds && movie.genreIds.length > 0) {
            const genreNames = convertGenreIdsToNames(movie.genreIds);
            console.log(
              `🎭 Genres for "${title}": [${movie.genreIds.join(
                ", "
              )}] → ["${genreNames.join('", "')}"]`
            );
          }

          const jellyseerrItemData: NewJellyseerrItem = {
            id: itemId,
            serverId: server.id,
            tmdbId: movie.id,
            title: title,
            originalTitle: movie.originalTitle || movie.originalName || null,
            overview: movie.overview || null,
            releaseDate: releaseDate,
            productionYear: releaseDate
              ? new Date(releaseDate).getFullYear()
              : null,
            type: itemType,
            communityRating: movie.voteAverage || null,
            popularity: movie.popularity || null,
            voteCount: movie.voteCount || null,
            posterPath: movie.posterPath || null,
            backdropPath: movie.backdropPath || null,
            originalLanguage: movie.originalLanguage || null,
            adult: movie.adult || false,
            genres: movie.genreIds
              ? convertGenreIdsToNames(movie.genreIds)
              : null,
            sourceType: "trending",
            mediaType: movie.title ? "movie" : movie.name ? "tv" : "movie",
            processed: false,
            embedding: null,
            rawData: movie,
          };

          await db
            .insert(jellyseerrItems)
            .values(jellyseerrItemData)
            .onConflictDoUpdate({
              target: jellyseerrItems.id,
              set: {
                title: jellyseerrItemData.title,
                originalTitle: jellyseerrItemData.originalTitle,
                overview: jellyseerrItemData.overview,
                communityRating: jellyseerrItemData.communityRating,
                popularity: jellyseerrItemData.popularity,
                voteCount: jellyseerrItemData.voteCount,
                genres: jellyseerrItemData.genres,
                processed: false,
                rawData: jellyseerrItemData.rawData,
                updatedAt: new Date(),
              },
            });

          syncedCount++;
        } catch (itemError) {
          console.error(
            `Error syncing trending movie ${movie.title} (${movie.id}):`,
            itemError
          );
          errorCount++;
          continue;
        }
      }
    } catch (trendingError) {
      console.error("Error fetching trending movies:", trendingError);
      errorCount++;
    }

    // Update last sync timestamp
    await db
      .update(servers)
      .set({ jellyseerrLastSync: new Date() })
      .where(eq(servers.id, serverId));

    console.log(`✅ Jellyseerr sync completed for server ${serverId}:`, {
      syncedCount,
      errorCount,
      duration: `${Math.floor((Date.now() - startTime) / 1000)}s`,
    });

    // Auto-trigger embedding generation for synced movies if embeddings are enabled
    if (syncedCount > 0) {
      try {
        const boss = await getJobQueue();

        // Check if embeddings can be generated (for manual sync, ignore autoGenerateEmbeddings setting)
        const hasEmbeddingProvider = !!server.embeddingProvider;
        const hasApiKey = !!(server.embeddingProvider === "openai"
          ? server.openAiApiToken
          : server.ollamaBaseUrl && server.ollamaModel);
        const canGenerateEmbeddings = hasEmbeddingProvider && hasApiKey;

        console.log(
          `🔍 Embedding configuration check for server ${serverId}:`,
          {
            embeddingProvider: server.embeddingProvider,
            hasRequiredCredentials: hasApiKey,
            canGenerateEmbeddings: canGenerateEmbeddings,
            note: "Manual sync ignores autoGenerateEmbeddings setting",
          }
        );

        if (canGenerateEmbeddings) {
          console.log(
            `🤖 Starting Jellyseerr embeddings generation for ${syncedCount} items (manual sync)`
          );

          const embeddingJobId = await boss.send(
            "generate-jellyseerr-embeddings",
            {
              serverId: server.id,
              provider: server.embeddingProvider,
              config: {
                openaiApiKey: server.openAiApiToken,
                ollamaBaseUrl: server.ollamaBaseUrl,
                ollamaModel: server.ollamaModel,
                ollamaApiToken: server.ollamaApiToken,
              },
            }
          );

          console.log(
            `Successfully queued Jellyseerr embeddings job with ID: ${embeddingJobId}`
          );
        } else {
          const missingItems = [];
          if (!hasEmbeddingProvider)
            missingItems.push("embeddingProvider is not set");
          if (!hasApiKey) {
            if (server.embeddingProvider === "openai") {
              missingItems.push("OpenAI API key is missing");
            } else if (server.embeddingProvider === "ollama") {
              missingItems.push(
                "Ollama configuration is incomplete (baseUrl/model missing)"
              );
            } else {
              missingItems.push("API credentials are missing");
            }
          }

          console.log(
            `❌ Skipping Jellyseerr embeddings - missing: ${missingItems.join(
              ", "
            )}`
          );
        }
      } catch (embeddingError) {
        console.error(
          "Failed to queue Jellyseerr embeddings job:",
          embeddingError
        );
        // Don't fail the sync job just because embeddings couldn't be queued
      }
    }

    await logJobResult(
      job.id,
      "sync-jellyseerr-popular-movies",
      "completed",
      {
        serverId,
        syncedCount,
        errorCount,
        duration: `${Math.floor((Date.now() - startTime) / 1000)}s`,
      },
      Date.now() - startTime
    );

    return { success: true, syncedCount, errorCount };
  } catch (error) {
    console.error(`❌ Jellyseerr sync failed for server ${serverId}:`, error);

    await logJobResult(
      job.id,
      "sync-jellyseerr-popular-movies",
      "failed",
      {
        serverId,
        error: error instanceof Error ? error.message : String(error),
      },
      Date.now() - startTime
    );

    throw error;
  }
}
