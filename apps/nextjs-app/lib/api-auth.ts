"use server";

import type { Server } from "@streamystats/database";
import { db, servers, users } from "@streamystats/database";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getSession, type SessionUser } from "./session";

/**
 * Parse MediaBrowser authorization header
 * Format: MediaBrowser Client="...", Device="...", DeviceId="...", Version="...", Token="..."
 * Note: Not exported to avoid Server Action async requirement
 */
function parseMediaBrowserHeader(authHeader: string): {
  token?: string;
  client?: string;
  device?: string;
  deviceId?: string;
  version?: string;
} | null {
  if (!authHeader.startsWith("MediaBrowser ")) {
    return null;
  }

  const params = authHeader.slice("MediaBrowser ".length);
  const result: Record<string, string> = {};

  // Parse key="value" pairs
  const regex = /(\w+)="([^"]*)"/g;
  for (const match of params.matchAll(regex)) {
    result[match[1].toLowerCase()] = match[2];
  }

  return {
    token: result.token,
    client: result.client,
    device: result.device,
    deviceId: result.deviceid,
    version: result.version,
  };
}

/**
 * Validates a Jellyfin session token and returns user info
 * Returns the user ID and admin status if valid
 */
export async function validateJellyfinToken(
  serverUrl: string,
  token: string,
): Promise<{ userId: string; userName: string; isAdmin: boolean } | null> {
  try {
    const response = await fetch(`${serverUrl}/Users/Me`, {
      method: "GET",
      headers: {
        "Authorization": `MediaBrowser Client="Streamystats", Token="${token}"`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return {
      userId: user.Id,
      userName: user.Name,
      isAdmin: user.Policy?.IsAdministrator ?? false,
    };
  } catch {
    return null;
  }
}

/**
 * Authenticate using MediaBrowser token header
 * Validates the token against all registered Jellyfin servers
 * Returns session user info if valid
 */
export async function authenticateMediaBrowser(
  request: NextRequest,
): Promise<{ session: SessionUser; server: Server } | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  const parsed = parseMediaBrowserHeader(authHeader);
  if (!parsed?.token) {
    return null;
  }

  // Get all servers and try to validate against each
  const allServers = await db.select().from(servers);

  for (const server of allServers) {
    const userInfo = await validateJellyfinToken(server.url, parsed.token);
    if (userInfo) {
      // Check if this user exists in our database for this server
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, userInfo.userId),
      });

      return {
        session: {
          id: userInfo.userId,
          name: userInfo.userName,
          serverId: server.id,
          isAdmin: userInfo.isAdmin || dbUser?.isAdministrator || false,
        },
        server,
      };
    }
  }

  return null;
}

/**
 * Validates API key from Authorization header against the actual Jellyfin server
 * Expected format: "Bearer <api-key>" or just "<api-key>"
 */
export async function validateApiKey({
  request,
  server,
}: {
  request: NextRequest;
  server: Server;
}): Promise<boolean> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    return false;
  }

  // Extract API key from Authorization header
  let apiKey: string;
  if (authHeader.startsWith("Bearer ")) {
    apiKey = authHeader.replace("Bearer ", "");
  } else {
    apiKey = authHeader;
  }

  try {
    // Validate the API key by making a request to the Jellyfin server
    // Use /Users/Me endpoint which requires valid authentication
    try {
      const response = await fetch(`${server.url}/System/Info`, {
        method: "GET",
        headers: {
          "Authorization": `MediaBrowser Client="Streamystats", Token="${apiKey}"`,
          "Content-Type": "application/json",
        },
        // Short timeout to avoid hanging requests
        signal: AbortSignal.timeout(5000),
      });

      // If the request succeeds, the API key is valid
      if (response.ok) {
        return true;
      }

      // If we get 401, the API key is invalid
      if (response.status === 401) {
        console.warn(
          `Invalid API key for server ${server.name} (${server.url})`,
        );
        return false;
      }

      // For other errors (500s, etc.), we consider it a server issue but invalid auth
      console.error(
        `Jellyfin server error during API key validation: ${response.status} ${response.statusText}`,
      );
      return false;
    } catch (fetchError) {
      // Handle network errors, timeouts, etc.
      if (fetchError instanceof Error) {
        if (fetchError.name === "AbortError") {
          console.error(`Timeout validating API key for server ${server.name}`);
        } else if (
          fetchError.message.includes("ECONNREFUSED") ||
          fetchError.message.includes("ENOTFOUND")
        ) {
          console.error(
            `Cannot connect to Jellyfin server ${server.name} (${server.url})`,
          );
        } else {
          console.error(
            `Network error validating API key for server ${server.name}:`,
            fetchError.message,
          );
        }
      }
      return false;
    }
  } catch (error) {
    console.error("Error validating API key:", error);
    return false;
  }
}

/**
 * Middleware helper to check API key authentication for a specific server
 * Returns null if valid, Response object if invalid
 */
export async function requireApiKey({
  request,
  server,
}: {
  request: NextRequest;
  server: Server;
}): Promise<Response | null> {
  const isValid = await validateApiKey({ request, server });

  if (!isValid) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized",
        message:
          "Valid API key required in Authorization header. The API key must be valid for the specified Jellyfin server.",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  return null;
}

/**
 * Requires a valid signed session cookie for API routes.
 * Returns null if valid, Response object with 401 if invalid.
 */
export async function requireSession(): Promise<
  | {
    error: Response;
    session: null;
  }
  | {
    error: null;
    session: SessionUser;
  }
> {
  const session = await getSession();

  if (!session) {
    return {
      error: new Response(
        JSON.stringify({
          error: "Unauthorized",
          message: "Valid session required. Please log in.",
        }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
      session: null,
    };
  }

  return { error: null, session };
}

/**
 * Requires authentication via either:
 * 1. Session cookie (web app login)
 * 2. MediaBrowser token header (external API clients)
 *
 * Use this for API endpoints that should support external access.
 */
export async function requireAuth(request: NextRequest): Promise<
  | {
    error: Response;
    session: null;
  }
  | {
    error: null;
    session: SessionUser;
  }
> {
  // Try session cookie first (web app)
  const session = await getSession();
  if (session) {
    return { error: null, session };
  }

  // Try MediaBrowser token (external API clients)
  const mediaBrowserAuth = await authenticateMediaBrowser(request);
  if (mediaBrowserAuth) {
    return { error: null, session: mediaBrowserAuth.session };
  }

  // No valid authentication found
  return {
    error: new Response(
      JSON.stringify({
        error: "Unauthorized",
        message:
          'Valid authentication required. Use session cookie or Authorization: MediaBrowser Token="..." header.',
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      },
    ),
    session: null,
  };
}

/**
 * Requires the user to be an admin based on the signed session.
 * Returns null if valid admin, Response object if unauthorized.
 */
export async function requireAdmin(): Promise<
  | {
    error: Response;
    session: null;
  }
  | {
    error: null;
    session: SessionUser;
  }
> {
  const result = await requireSession();

  if (result.error) {
    return result;
  }

  if (!result.session.isAdmin) {
    return {
      error: new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Admin privileges required.",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
      session: null,
    };
  }

  return { error: null, session: result.session };
}
