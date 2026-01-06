import type { Server } from "@streamystats/database";
import type { NextRequest } from "next/server";
import {
  authenticateMediaBrowser,
  validateJellyfinToken,
} from "@/lib/api-auth";
import {
  hasServerIdentifier,
  parseServerIdentifier,
  resolveServer,
  type ServerIdentifier,
} from "@/lib/db/server-resolver";
import {
  getSimilarSeries,
  type SeriesRecommendationItem,
} from "@/lib/db/similar-series-statistics";
import {
  getSimilarStatistics,
  type RecommendationItem,
} from "@/lib/db/similar-statistics";
import { authenticateByName } from "@/lib/jellyfin-auth";

type RecommendationType = "Movie" | "Series" | "all";
type RangePreset = "7d" | "30d" | "90d" | "thisMonth" | "all";
type ResponseFormat = "full" | "ids";

type ResolvedParams = {
  serverId: number;
  serverName: string;
  limit: number;
  type: RecommendationType;
  range: RangePreset;
  start: string | null;
  end: string | null;
  includeBasedOn: boolean;
  includeReasons: boolean;
  targetUserId: string | null;
  format: ResponseFormat;
};

/**
 * IDs-only response format for Jellyfin API integration
 */
export type RecommendationIdsResponse = {
  movies: string[];
  series: string[];
  total: number;
};

type ApiUser = {
  id: string;
  name: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function clampInt(value: number, { min, max }: { min: number; max: number }) {
  return Math.min(max, Math.max(min, value));
}

function parseBooleanParam(value: string | null, defaultValue: boolean) {
  if (value === null) return defaultValue;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return defaultValue;
}

function isValidRecommendationType(value: string): value is RecommendationType {
  return value === "Movie" || value === "Series" || value === "all";
}

function isValidRangePreset(value: string): value is RangePreset {
  return (
    value === "7d" ||
    value === "30d" ||
    value === "90d" ||
    value === "thisMonth" ||
    value === "all"
  );
}

function toIsoUtcMicro(date: Date): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1, 2);
  const d = pad(date.getUTCDate(), 2);
  const hh = pad(date.getUTCHours(), 2);
  const mm = pad(date.getUTCMinutes(), 2);
  const ss = pad(date.getUTCSeconds(), 2);
  const micros = pad(date.getUTCMilliseconds() * 1000, 6);
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}.${micros}Z`;
}

function parseDateParam(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getPresetWindow(preset: RangePreset): { start?: Date; end?: Date } {
  if (preset === "all") return {};
  const now = new Date();

  if (preset === "thisMonth") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    return { start, end: now };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end: now };
}

function getRecommendationReason(args: {
  recommendation: {
    item: { name: string; genres: string[] | null };
    basedOn: Array<{ name: string; genres: string[] | null }>;
  };
}): string {
  const { recommendation } = args;
  if (!recommendation.basedOn || recommendation.basedOn.length === 0) {
    return "Popular on this server";
  }

  const baseNames = recommendation.basedOn.slice(0, 3).map((b) => b.name);
  const baseReason =
    baseNames.length === 1
      ? `Because you watched "${baseNames[0]}"`
      : `Because you watched "${baseNames.slice(0, -1).join('", "')}" and "${
          baseNames[baseNames.length - 1]
        }"`;

  const recGenres = new Set(recommendation.item.genres ?? []);
  const shared = recommendation.basedOn.flatMap((b) =>
    (b.genres ?? []).filter((g) => recGenres.has(g)),
  );
  const uniqueShared = [...new Set(shared)].slice(0, 3);

  if (uniqueShared.length === 0) return baseReason;
  return `${baseReason} (shared: ${uniqueShared.join(", ")})`;
}

function isValidFormat(value: string): value is ResponseFormat {
  return value === "full" || value === "ids";
}

function parseQueryParams(searchParams: URLSearchParams):
  | {
      ok: true;
      params: Omit<ResolvedParams, "serverId" | "serverName">;
      serverIdentifier: ServerIdentifier;
      timeWindow: { start?: Date; end?: Date };
      targetUserId: string | null;
    }
  | { ok: false; error: string } {
  const serverIdentifier = parseServerIdentifier(searchParams);
  if (!hasServerIdentifier(serverIdentifier)) {
    return {
      ok: false,
      error:
        "Server identifier required. Use one of: serverId, serverName, serverUrl, or jellyfinServerId",
    };
  }

  const limitRaw = searchParams.get("limit");
  const limit = clampInt(Number.parseInt(limitRaw ?? "20", 10) || 20, {
    min: 1,
    max: 100,
  });

  const typeRaw = searchParams.get("type") ?? "all";
  if (!isValidRecommendationType(typeRaw)) {
    return {
      ok: false,
      error: "Invalid 'type'. Must be Movie, Series, or all.",
    };
  }

  const rangeRaw = searchParams.get("range") ?? "all";
  if (!isValidRangePreset(rangeRaw)) {
    return {
      ok: false,
      error: "Invalid 'range'. Must be 7d, 30d, 90d, thisMonth, or all.",
    };
  }

  const formatRaw = searchParams.get("format") ?? "full";
  if (!isValidFormat(formatRaw)) {
    return {
      ok: false,
      error: "Invalid 'format'. Must be full or ids.",
    };
  }

  const startRaw = searchParams.get("start");
  const endRaw = searchParams.get("end");
  const includeBasedOn = parseBooleanParam(
    searchParams.get("includeBasedOn"),
    true,
  );
  const includeReasons = parseBooleanParam(
    searchParams.get("includeReasons"),
    true,
  );

  let start: Date | undefined;
  let end: Date | undefined;

  if (startRaw) {
    const d = parseDateParam(startRaw);
    if (!d)
      return { ok: false, error: "Invalid 'start'. Must be an ISO timestamp." };
    start = d;
  }
  if (endRaw) {
    const d = parseDateParam(endRaw);
    if (!d)
      return { ok: false, error: "Invalid 'end'. Must be an ISO timestamp." };
    end = d;
  }

  if (start && end && start.getTime() > end.getTime()) {
    return { ok: false, error: "'start' must be <= 'end'." };
  }

  let timeWindow: { start?: Date; end?: Date } = {};
  if (start || end) {
    timeWindow = { start, end };
  } else {
    timeWindow = getPresetWindow(rangeRaw);
  }

  const targetUserId = searchParams.get("targetUserId");

  return {
    ok: true,
    serverIdentifier,
    timeWindow,
    targetUserId,
    params: {
      limit,
      type: typeRaw,
      range: rangeRaw,
      start: timeWindow.start ? toIsoUtcMicro(timeWindow.start) : null,
      end: timeWindow.end ? toIsoUtcMicro(timeWindow.end) : null,
      includeBasedOn,
      includeReasons,
      targetUserId,
      format: formatRaw,
    },
  };
}

async function buildRecommendationsResponse(args: {
  server: Server;
  user: ApiUser;
  params: Omit<ResolvedParams, "serverId" | "serverName">;
  timeWindow: { start?: Date; end?: Date };
}) {
  const { server, user, params, timeWindow } = args;

  const fetchLimit = Math.min(200, Math.max(params.limit * 4, params.limit));

  // Fetch from appropriate sources based on type
  let movieResults: RecommendationItem[] = [];
  let seriesResults: SeriesRecommendationItem[] = [];

  if (params.type === "Movie" || params.type === "all") {
    movieResults = await getSimilarStatistics(
      server.id,
      user.id,
      fetchLimit,
      0,
      {
        start: timeWindow.start,
        end: timeWindow.end,
      },
    );
  }

  if (params.type === "Series" || params.type === "all") {
    seriesResults = await getSimilarSeries(server.id, user.id, fetchLimit, 0);
  }

  // Combine and sort by similarity (both types have compatible structure)
  const combined = [...movieResults, ...seriesResults].sort(
    (a, b) => b.similarity - a.similarity,
  );

  const limitedResults = combined.slice(0, params.limit);

  // Return IDs-only format for Jellyfin API integration
  if (params.format === "ids") {
    const movies: string[] = [];
    const series: string[] = [];

    for (const r of limitedResults) {
      if (r.item.type === "Movie") {
        movies.push(r.item.id);
      } else if (r.item.type === "Series") {
        series.push(r.item.id);
      }
    }

    const idsResponse: RecommendationIdsResponse = {
      movies,
      series,
      total: movies.length + series.length,
    };

    return { data: idsResponse };
  }

  // Full format (default)
  const data = limitedResults.map((r) => {
    const base = {
      item: r.item,
      similarity: r.similarity,
      basedOn: params.includeBasedOn ? r.basedOn : [],
    };

    if (!params.includeReasons) return base;

    return {
      ...base,
      reason: getRecommendationReason({
        recommendation: {
          item: {
            name: r.item.name,
            genres: r.item.genres ?? null,
          },
          basedOn: (params.includeBasedOn ? r.basedOn : []).map((b) => ({
            name: b.name,
            genres: b.genres ?? null,
          })),
        },
      }),
    };
  });

  return {
    server: { id: server.id, name: server.name },
    user: { id: user.id, name: user.name },
    params: {
      serverId: server.id,
      serverName: server.name,
      ...params,
    } satisfies ResolvedParams,
    data,
  };
}

export async function GET(request: NextRequest) {
  const parsed = parseQueryParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const server = await resolveServer(parsed.serverIdentifier);
  if (!server) {
    return jsonResponse({ error: "Server not found" }, 404);
  }

  // Try MediaBrowser auth (Authorization: MediaBrowser Token="...")
  const mediaBrowserAuth = await authenticateMediaBrowser(request);
  if (!mediaBrowserAuth) {
    return jsonResponse(
      {
        error: "Unauthorized",
        message:
          'Valid Jellyfin token required. Use Authorization: MediaBrowser Token="..." header.',
      },
      401,
    );
  }

  // Verify the authenticated server matches the requested server
  if (mediaBrowserAuth.server.id !== server.id) {
    // Token is valid but for a different server - try validating against requested server
    const authHeader = request.headers.get("authorization");
    const tokenMatch = authHeader?.match(/Token="([^"]*)"/i);
    const token = tokenMatch?.[1];

    if (token) {
      const userInfo = await validateJellyfinToken(server.url, token);
      if (userInfo) {
        let targetUser: ApiUser = {
          id: userInfo.userId,
          name: userInfo.userName,
        };
        if (userInfo.isAdmin && parsed.targetUserId) {
          targetUser = { id: parsed.targetUserId, name: null };
        }
        const payload = await buildRecommendationsResponse({
          server,
          user: targetUser,
          params: parsed.params,
          timeWindow: parsed.timeWindow,
        });
        return jsonResponse(payload, 200);
      }
    }

    return jsonResponse(
      {
        error: "Unauthorized",
        message: "Token is not valid for the requested server.",
      },
      401,
    );
  }

  // DEFAULT: Use the authenticated user
  let targetUser: ApiUser = {
    id: mediaBrowserAuth.session.id,
    name: mediaBrowserAuth.session.name,
  };

  // OVERRIDE: If Admin, allow fetching for another user
  if (mediaBrowserAuth.session.isAdmin && parsed.targetUserId) {
    targetUser = { id: parsed.targetUserId, name: null };
  }

  const payload = await buildRecommendationsResponse({
    server,
    user: targetUser,
    params: parsed.params,
    timeWindow: parsed.timeWindow,
  });

  return jsonResponse(payload, 200);
}

export async function POST(request: NextRequest) {
  const parsed = parseQueryParams(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  const server = await resolveServer(parsed.serverIdentifier);
  if (!server) {
    return jsonResponse({ error: "Server not found" }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("username" in body) ||
    !("password" in body)
  ) {
    return jsonResponse(
      { error: "Body must be { username: string, password: string }" },
      400,
    );
  }

  const username = (body as { username: unknown }).username;
  const password = (body as { password: unknown }).password;
  if (typeof username !== "string" || typeof password !== "string") {
    return jsonResponse(
      { error: "username and password must be strings" },
      400,
    );
  }

  const auth = await authenticateByName({
    serverUrl: server.url,
    username,
    password,
  });
  if (!auth.ok) {
    return jsonResponse({ error: "Unauthorized", message: auth.error }, 401);
  }

  const payload = await buildRecommendationsResponse({
    server,
    user: { id: auth.user.id, name: auth.user.name },
    params: parsed.params,
    timeWindow: parsed.timeWindow,
  });

  return jsonResponse(payload, 200);
}
