import { buildAuthHeaders as baseBuildAuthHeaders } from "@streamystats/database";

/**
 * Server information needed for auth header generation
 */
export interface ServerAuthInfo {
  id: number;
  version: string | null;
}

/**
 * Build auth headers for making requests to Jellyfin from the Next.js app
 * Automatically selects between MediaBrowser and X-Emby-Token based on server version
 *
 * @param token - API key or user access token
 * @param server - Server info with id and version, or null for legacy auth
 * @returns Headers object ready for fetch()
 */
export function getAuthHeaders(
  token: string,
  server?: ServerAuthInfo | null
): Record<string, string> {
  return baseBuildAuthHeaders(token, server?.version ?? null, {
    serverId: server?.id,
    appContext: "web",
  });
}
