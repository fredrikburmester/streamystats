import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  globalSearch,
  type SearchResult,
  type SearchResults,
} from "@/lib/db/search";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Categorized IDs response format for Jellyfin API integration
 * Each category contains Jellyfin IDs that can be used with Jellyfin API
 */
export type SearchIdsResponse = {
  movies: string[];
  series: string[];
  episodes: string[];
  seasons: string[];
  audio: string[];
  actors: string[];
  directors: string[];
  writers: string[];
  total: number;
};

/**
 * Valid filter types for search
 */
export type SearchFilterType =
  | "all" // All types (default)
  | "media" // All media items (movies, series, episodes, etc.)
  | "movies" // Movies only
  | "series" // TV series only
  | "episodes" // Episodes only
  | "audio" // Audio/music only
  | "people" // All people (actors, directors, writers)
  | "actors" // Actors only
  | "directors" // Directors only
  | "writers" // Writers only
  | "users" // Jellyfin users
  | "watchlists" // Watchlists
  | "activities" // Activities
  | "sessions"; // Sessions/history

const emptyIdsResponse: SearchIdsResponse = {
  movies: [],
  series: [],
  episodes: [],
  seasons: [],
  audio: [],
  actors: [],
  directors: [],
  writers: [],
  total: 0,
};

const emptyFullResponse: SearchResults = {
  items: [],
  users: [],
  watchlists: [],
  activities: [],
  sessions: [],
  actors: [],
  total: 0,
};

/**
 * Categorize items by their subtype
 */
function categorizeItems(items: SearchResult[]): {
  movies: SearchResult[];
  series: SearchResult[];
  episodes: SearchResult[];
  seasons: SearchResult[];
  audio: SearchResult[];
} {
  const result = {
    movies: [] as SearchResult[],
    series: [] as SearchResult[],
    episodes: [] as SearchResult[],
    seasons: [] as SearchResult[],
    audio: [] as SearchResult[],
  };

  for (const item of items) {
    switch (item.subtype) {
      case "Movie":
        result.movies.push(item);
        break;
      case "Series":
        result.series.push(item);
        break;
      case "Episode":
        result.episodes.push(item);
        break;
      case "Season":
        result.seasons.push(item);
        break;
      case "Audio":
      case "MusicAlbum":
      case "MusicArtist":
      case "MusicVideo":
        result.audio.push(item);
        break;
      default:
        // Put uncategorized items in movies as fallback
        result.movies.push(item);
    }
  }

  return result;
}

/**
 * Categorize actors/people by their subtype
 */
function categorizePeople(actors: SearchResult[]): {
  actors: SearchResult[];
  directors: SearchResult[];
  writers: SearchResult[];
} {
  const result = {
    actors: [] as SearchResult[],
    directors: [] as SearchResult[],
    writers: [] as SearchResult[],
  };

  for (const person of actors) {
    switch (person.subtype) {
      case "Director":
        result.directors.push(person);
        break;
      case "Writer":
        result.writers.push(person);
        break;
      default:
        result.actors.push(person);
    }
  }

  return result;
}

/**
 * Filter results based on type parameter
 */
function filterResults(
  results: SearchResults,
  type: SearchFilterType,
): SearchResults {
  switch (type) {
    case "all":
      return results;

    case "media":
      return {
        ...emptyFullResponse,
        items: results.items,
        total: results.items.length,
      };

    case "movies":
      return {
        ...emptyFullResponse,
        items: results.items.filter((i) => i.subtype === "Movie"),
        total: results.items.filter((i) => i.subtype === "Movie").length,
      };

    case "series":
      return {
        ...emptyFullResponse,
        items: results.items.filter((i) => i.subtype === "Series"),
        total: results.items.filter((i) => i.subtype === "Series").length,
      };

    case "episodes":
      return {
        ...emptyFullResponse,
        items: results.items.filter((i) => i.subtype === "Episode"),
        total: results.items.filter((i) => i.subtype === "Episode").length,
      };

    case "audio":
      return {
        ...emptyFullResponse,
        items: results.items.filter((i) =>
          ["Audio", "MusicAlbum", "MusicArtist", "MusicVideo"].includes(
            i.subtype || "",
          ),
        ),
        total: results.items.filter((i) =>
          ["Audio", "MusicAlbum", "MusicArtist", "MusicVideo"].includes(
            i.subtype || "",
          ),
        ).length,
      };

    case "people":
      return {
        ...emptyFullResponse,
        actors: results.actors,
        total: results.actors.length,
      };

    case "actors":
      return {
        ...emptyFullResponse,
        actors: results.actors.filter((a) => a.subtype === "Actor"),
        total: results.actors.filter((a) => a.subtype === "Actor").length,
      };

    case "directors":
      return {
        ...emptyFullResponse,
        actors: results.actors.filter((a) => a.subtype === "Director"),
        total: results.actors.filter((a) => a.subtype === "Director").length,
      };

    case "writers":
      return {
        ...emptyFullResponse,
        actors: results.actors.filter((a) => a.subtype === "Writer"),
        total: results.actors.filter((a) => a.subtype === "Writer").length,
      };

    case "users":
      return {
        ...emptyFullResponse,
        users: results.users,
        total: results.users.length,
      };

    case "watchlists":
      return {
        ...emptyFullResponse,
        watchlists: results.watchlists,
        total: results.watchlists.length,
      };

    case "activities":
      return {
        ...emptyFullResponse,
        activities: results.activities,
        total: results.activities.length,
      };

    case "sessions":
      return {
        ...emptyFullResponse,
        sessions: results.sessions,
        total: results.sessions.length,
      };

    default:
      return results;
  }
}

/**
 * GET /api/search
 * Global search across all entity types
 *
 * Query params:
 * - q: search query (required)
 * - limit: max results per category (default: 10, max: 100)
 * - format: response format - "full" (default) or "ids"
 *   - "full": returns complete search results with metadata
 *   - "ids": returns only Jellyfin item/actor IDs categorized by type
 * - type: filter by type (optional)
 *   - "all" (default), "media", "movies", "series", "episodes", "audio"
 *   - "people", "actors", "directors", "writers"
 *   - "users", "watchlists", "activities", "sessions"
 *
 * Examples:
 *   GET /api/search?q=matrix&limit=20
 *   GET /api/search?q=keanu&type=actors&format=ids&limit=5
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { session } = auth;
  const searchParams = request.nextUrl.searchParams;

  const query = searchParams.get("q");
  const format = searchParams.get("format") || "full";
  const type = (searchParams.get("type") || "all") as SearchFilterType;

  if (!query || query.trim() === "") {
    if (format === "ids") {
      return jsonResponse(
        {
          error: "Search query is required",
          data: emptyIdsResponse,
        },
        400,
      );
    }
    return jsonResponse(
      {
        error: "Search query is required",
        data: emptyFullResponse,
      },
      400,
    );
  }

  const limitParam = searchParams.get("limit");
  const limit = limitParam
    ? Math.min(100, Math.max(1, parseInt(limitParam, 10)))
    : 10;

  const viewerUserId = session.isAdmin ? undefined : session.id;
  const results = await globalSearch(
    session.serverId,
    query.trim(),
    session.id,
    {
      itemLimit: limit,
      userLimit: limit,
      watchlistLimit: limit,
      activityLimit: limit,
      sessionLimit: limit,
      actorLimit: limit,
    },
    viewerUserId,
  );

  // Apply type filter
  const filteredResults = filterResults(results, type);

  // Return IDs-only format for Jellyfin API integration
  if (format === "ids") {
    const categorizedItems = categorizeItems(filteredResults.items);
    const categorizedPeople = categorizePeople(filteredResults.actors);

    const idsResponse: SearchIdsResponse = {
      movies: categorizedItems.movies.slice(0, limit).map((i) => i.id),
      series: categorizedItems.series.slice(0, limit).map((i) => i.id),
      episodes: categorizedItems.episodes.slice(0, limit).map((i) => i.id),
      seasons: categorizedItems.seasons.slice(0, limit).map((i) => i.id),
      audio: categorizedItems.audio.slice(0, limit).map((i) => i.id),
      actors: categorizedPeople.actors.slice(0, limit).map((p) => p.id),
      directors: categorizedPeople.directors.slice(0, limit).map((p) => p.id),
      writers: categorizedPeople.writers.slice(0, limit).map((p) => p.id),
      total: filteredResults.items.length + filteredResults.actors.length,
    };
    return jsonResponse({ data: idsResponse });
  }

  // Return full format (default)
  return jsonResponse({ data: filteredResults });
}
