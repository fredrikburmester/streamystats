"use server";

export interface JellyseerrMovie {
  id: number;
  title: string;
  overview: string;
  releaseDate: string;
  posterPath?: string;
  backdropPath?: string;
  genreIds: number[];
  voteAverage: number;
  popularity: number;
  adult: boolean;
  originalLanguage: string;
  originalTitle: string;
  video: boolean;
  voteCount: number;
  mediaType: "movie";
}

export interface JellyseerrTvShow {
  id: number;
  name: string;
  overview: string;
  firstAirDate: string;
  posterPath?: string;
  backdropPath?: string;
  genreIds: number[];
  voteAverage: number;
  popularity: number;
  originalLanguage: string;
  originalName: string;
  voteCount: number;
  mediaType: "tv";
  originCountry: string[];
}

export interface JellyseerrStatus {
  version: string;
  commitTag: string;
  updateAvailable: boolean;
  commitsBehind: number;
}

export interface JellyseerrRequestBody {
  mediaType: "movie" | "tv";
  mediaId: number;
  seasons?: number[]; // For TV shows
  is4k?: boolean;
}

export interface JellyseerrRequest {
  id: number;
  status: number;
  media: {
    id: number;
    tmdbId: number;
    tvdbId?: number;
    imdbId?: string;
    mediaType: "movie" | "tv";
    status: number;
    requests: JellyseerrRequest[];
  };
  requestedBy: {
    id: number;
    displayName: string;
    username?: string;
    email: string;
    avatar: string;
  };
  modifiedBy?: {
    id: number;
    displayName: string;
    username?: string;
    email: string;
    avatar: string;
  };
  createdAt: string;
  updatedAt: string;
  type: string;
  seasons?: {
    id: number;
    seasonNumber: number;
    status: number;
  }[];
}

export class JellyseerrClient {
  private baseUrl: string;
  private cookies: string[];
  private xsrfToken: string | null;

  constructor(baseUrl: string, sessionCookies: string[] = []) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.cookies = sessionCookies;
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

    // Prepare headers with proper authentication
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    // Add session cookies
    if (this.cookies.length > 0) {
      headers.Cookie = this.cookies
        .map((cookie) => cookie.split(";")[0])
        .join("; ");
    }

    // Add XSRF token for CSRF protection
    if (this.xsrfToken) {
      headers["XSRF-TOKEN"] = this.xsrfToken;
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // Important for cookie-based auth
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(
        `Jellyseerr API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  // Get server status
  async getStatus(): Promise<JellyseerrStatus> {
    return await this.fetch("/status");
  }

  // Get popular movies from Jellyseerr using correct discover endpoint
  async getPopularMovies(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrMovie[];
  }> {
    return await this.fetch(`/discover/movies?page=${page}`);
  }

  // Get popular TV shows from Jellyseerr
  async getPopularTvShows(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrTvShow[];
  }> {
    return await this.fetch(`/discover/tv/popular?page=${page}`);
  }

  // Get trending content using correct discover endpoint
  async getTrendingMovies(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrMovie[];
  }> {
    return await this.fetch(`/discover/trending?page=${page}`);
  }

  // Get upcoming movies with release date filter
  async getUpcomingMovies(page: number = 1): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: JellyseerrMovie[];
  }> {
    const today = new Date().toISOString().split("T")[0];
    return await this.fetch(
      `/discover/movies?page=${page}&primaryReleaseDateGte=${today}`
    );
  }

  // Generic discover method following the reference implementation pattern
  async discover(
    endpoint: string,
    params: Record<string, any> = {}
  ): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: (JellyseerrMovie | JellyseerrTvShow)[];
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const url = queryParams.toString()
      ? `${endpoint}?${queryParams}`
      : endpoint;
    return await this.fetch(url);
  }

  // Search for movies and TV shows
  async search(
    query: string,
    page: number = 1
  ): Promise<{
    page: number;
    totalPages: number;
    totalResults: number;
    results: (JellyseerrMovie | JellyseerrTvShow)[];
  }> {
    return await this.fetch(
      `/search?query=${encodeURIComponent(query)}&page=${page}`
    );
  }

  // Create a new request
  async createRequest(
    requestData: JellyseerrRequestBody
  ): Promise<JellyseerrRequest> {
    return await this.fetch("/request", {
      method: "POST",
      body: JSON.stringify(requestData),
    });
  }

  // Get all requests
  async getRequests(
    take: number = 10,
    skip: number = 0
  ): Promise<{
    pageInfo: {
      pages: number;
      pageSize: number;
      results: number;
      page: number;
    };
    results: JellyseerrRequest[];
  }> {
    return await this.fetch(`/request?take=${take}&skip=${skip}`);
  }

  // Get user's requests
  async getUserRequests(
    userId: number,
    take: number = 10,
    skip: number = 0
  ): Promise<{
    pageInfo: {
      pages: number;
      pageSize: number;
      results: number;
      page: number;
    };
    results: JellyseerrRequest[];
  }> {
    return await this.fetch(
      `/user/${userId}/requests?take=${take}&skip=${skip}`
    );
  }

  // Delete a request
  async deleteRequest(requestId: number): Promise<void> {
    await this.fetch(`/request/${requestId}`, {
      method: "DELETE",
    });
  }

  // Get movie details by TMDB ID
  async getMovieDetails(tmdbId: number): Promise<
    JellyseerrMovie & {
      genres: { id: number; name: string }[];
      runtime: number;
      budget: number;
      revenue: number;
      tagline: string;
      credits: {
        cast: Array<{
          id: number;
          name: string;
          character: string;
          profilePath?: string;
        }>;
        crew: Array<{
          id: number;
          name: string;
          job: string;
          department: string;
          profilePath?: string;
        }>;
      };
    }
  > {
    return await this.fetch(`/movie/${tmdbId}`);
  }

  // Get TV show details by TMDB ID
  async getTvShowDetails(tmdbId: number): Promise<
    JellyseerrTvShow & {
      genres: { id: number; name: string }[];
      numberOfEpisodes: number;
      numberOfSeasons: number;
      seasons: Array<{
        id: number;
        seasonNumber: number;
        name: string;
        overview: string;
        airDate: string;
        episodeCount: number;
        posterPath?: string;
      }>;
      credits: {
        cast: Array<{
          id: number;
          name: string;
          character: string;
          profilePath?: string;
        }>;
        crew: Array<{
          id: number;
          name: string;
          job: string;
          department: string;
          profilePath?: string;
        }>;
      };
    }
  > {
    return await this.fetch(`/tv/${tmdbId}`);
  }
}

// Helper function to create a Jellyseerr client from server configuration and user session data
export async function createJellyseerrClientFromServer(
  serverId: number
): Promise<JellyseerrClient | null> {
  const { getServer } = await import("./db/server");
  const { getJellyseerrSession } = await import("./auth");

  const server = await getServer({ serverId });
  if (!server || !server.enableJellyseerrIntegration || !server.jellyseerrUrl) {
    return null;
  }

  // Get user-specific session data from cookies
  const sessionData = await getJellyseerrSession();
  if (!sessionData || !sessionData.cookies.length) {
    return null;
  }

  return new JellyseerrClient(server.jellyseerrUrl, sessionData.cookies);
}
