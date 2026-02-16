import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { basePath } from "@/lib/utils";
import { getServer, getServers } from "./lib/db/server";

/**
 * Middleware with Signed Session Authentication
 *
 * Security features:
 * 1. **Signed Session Cookie**: Uses JWT to cryptographically sign session data, preventing tampering
 * 2. **Token Verification**: Validates Jellyfin access token to ensure it hasn't expired
 * 3. **Server Connectivity Handling**: Gracefully handles server connectivity issues
 * 4. **Automatic Cookie Cleanup**: Removes invalid cookies when authentication fails
 *
 * Authentication Flow:
 * 1. Verify JWT signature on session cookie (tamper-proof)
 * 2. Validate Jellyfin access token is still valid
 * 3. Check server access and admin permissions
 * 4. Clear cookies and redirect to login if validation fails
 */

const SESSION_SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET || "fallback-dev-secret-change-in-production",
);

interface SessionUser {
  id: string;
  name: string;
  serverId: number;
  isAdmin: boolean;
}

enum ResultType {
  Success = "SUCCESS",
  Error = "ERROR",
  ServerConnectivityError = "SERVER_CONNECTIVITY_ERROR",
}

type Result<T> =
  | {
      type: ResultType.Success;
      data: T;
    }
  | {
      type: ResultType.Error;
      error: string;
    }
  | {
      type: ResultType.ServerConnectivityError;
      error: string;
    };

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|favicon.svg|favicon-96x96.png|icon.png|web-app-manifest-|manifest.json).*)",
  ],
};

const ADMIN_ONLY_PATHS = [
  "history",
  "settings",
  "activities",
  "users",
  "setup",
];
const ADMIN_ONLY_SUB_PATHS: Record<string, string[]> = {
  dashboard: ["security"],
};
const ADMIN_ONLY_USER_SUB_PATHS = ["security"];
const PUBLIC_PATHS = ["login", "reconnect"];

const BASE_PATH_REGEX = basePath.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * Parse URL pathname to extract server ID, page, and user name
 */
const parsePathname = (pathname: string) => {
  const segments = basePath
    ? pathname
        .replace(new RegExp(`^${BASE_PATH_REGEX}`), "")
        .split("/")
        .filter(Boolean)
    : pathname.split("/").filter(Boolean);

  // Handle /setup
  if (segments[0] === "setup") {
    return { page: "setup" };
  }

  // Handle /not-found
  if (segments[0] === "not-found") {
    return { page: "not-found" };
  }

  // Handle /servers/:id/...
  if (segments[0] === "servers" && segments[1]) {
    const id = segments[1];
    const page = segments[2];
    const subPage = segments[3];

    // Handle /servers/:id/users/:name/:userSubPage
    if (page === "users" && segments[3]) {
      return { id, page, name: segments[3], userSubPage: segments[4] };
    }

    // Handle /servers/:id/items/:itemId
    if (page === "items" && segments[3]) {
      return { id, page, itemId: segments[3] };
    }

    // Handle /servers/:id/:page/:subPage
    return { id, page, subPage };
  }

  return {};
};

/**
 * Retrieves the user from the signed session cookie.
 * The JWT signature ensures the cookie cannot be tampered with.
 */
const getSessionUser = async (
  request: NextRequest,
): Promise<Result<SessionUser>> => {
  const sessionCookie = request.cookies.get("streamystats-session");

  if (!sessionCookie?.value) {
    return {
      type: ResultType.Error,
      error: "No session cookie found",
    };
  }

  try {
    // Verify JWT signature - this ensures the cookie hasn't been tampered with
    const { payload } = await jwtVerify(sessionCookie.value, SESSION_SECRET);

    const session: SessionUser = {
      id: payload.id as string,
      name: payload.name as string,
      serverId: payload.serverId as number,
      isAdmin: payload.isAdmin as boolean,
    };

    // Validate the Jellyfin token is still valid
    const tokenValidation = await validateJellyfinToken(request, session);
    if (tokenValidation.type === ResultType.Error) {
      return {
        type: ResultType.Error,
        error: tokenValidation.error,
      };
    }
    if (tokenValidation.type === ResultType.ServerConnectivityError) {
      return {
        type: ResultType.ServerConnectivityError,
        error: tokenValidation.error,
      };
    }

    return {
      type: ResultType.Success,
      data: session,
    };
  } catch {
    // JWT verification failed - invalid signature, expired, or malformed
    return {
      type: ResultType.Error,
      error: "Invalid or expired session",
    };
  }
};

/**
 * Validates that the Jellyfin access token is still valid.
 * This catches expired/revoked tokens even though the session JWT is valid.
 */
const validateJellyfinToken = async (
  request: NextRequest,
  session: SessionUser,
): Promise<Result<boolean>> => {
  const tokenCookie = request.cookies.get("streamystats-token");
  if (!tokenCookie?.value) {
    return {
      type: ResultType.Error,
      error: "No access token found",
    };
  }

  const server = await getServer({ serverId: session.serverId.toString() });
  if (!server) {
    return {
      type: ResultType.Error,
      error: "Server not found",
    };
  }

  try {
    const jellyfinResponse = await fetch(`${server.url}/Users/Me`, {
      method: "GET",
      headers: {
        Authorization: `MediaBrowser Client="Streamystats", Version="${process.env.version}", Token="${tokenCookie.value}"`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!jellyfinResponse.ok) {
      if (jellyfinResponse.status === 401) {
        return {
          type: ResultType.Error,
          error: "Access token is invalid or expired",
        };
      }
      return {
        type: ResultType.ServerConnectivityError,
        error: `Jellyfin server returned ${jellyfinResponse.status}`,
      };
    }

    const jellyfinUser = await jellyfinResponse.json();

    // Verify the user ID matches the signed session
    if (jellyfinUser.Id !== session.id) {
      return {
        type: ResultType.Error,
        error: "User ID mismatch - session may be compromised",
      };
    }

    if (jellyfinUser.IsDisabled) {
      return {
        type: ResultType.Error,
        error: "User account is disabled on Jellyfin server",
      };
    }

    return { type: ResultType.Success, data: true };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.includes("timeout") ||
        error.message.includes("connection") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND"))
    ) {
      return {
        type: ResultType.ServerConnectivityError,
        error: "Unable to connect to Jellyfin server",
      };
    }

    return {
      type: ResultType.Error,
      error: "Failed to verify Jellyfin token",
    };
  }
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { id, page, subPage, name, userSubPage } = parsePathname(pathname);

  const servers = await getServers();

  // If there are no servers, redirect to /setup
  if (servers.length === 0) {
    if (page === "setup") {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(`${basePath}/setup`, request.url));
  }

  // If the server does not exist
  if (id && !servers.some((s) => Number(s.id) === Number(id))) {
    return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
  }

  // If the page is public, return the response
  if (page && PUBLIC_PATHS.includes(page)) {
    return NextResponse.next();
  }

  // Get user from signed session cookie
  const sessionResult = await getSessionUser(request);

  // Handle server connectivity error
  if (sessionResult.type === ResultType.ServerConnectivityError) {
    console.warn("Server connectivity issue detected.", sessionResult.error);

    // If we're already on the reconnect page, allow access
    if (page === "reconnect") {
      return NextResponse.next();
    }

    // Redirect to reconnect page
    if (id) {
      return NextResponse.redirect(
        new URL(`${basePath}/servers/${id}/reconnect`, request.url),
      );
    }
    if (servers.length > 0) {
      return NextResponse.redirect(
        new URL(`${basePath}/servers/${servers[0].id}/reconnect`, request.url),
      );
    }
    return NextResponse.redirect(new URL(`${basePath}/setup`, request.url));
  }

  // If the user is not logged in or has invalid credentials
  if (sessionResult.type === ResultType.Error) {
    let redirectUrl: URL;
    if (id) {
      redirectUrl = new URL(`${basePath}/servers/${id}/login`, request.url);
    } else if (servers.length > 0) {
      redirectUrl = new URL(
        `${basePath}/servers/${servers[0].id}/login`,
        request.url,
      );
    } else {
      redirectUrl = new URL(`${basePath}/setup`, request.url);
    }

    const response = NextResponse.redirect(redirectUrl);

    // Clear all auth cookies
    response.cookies.delete("streamystats-session");
    response.cookies.delete("streamystats-token");
    response.cookies.delete("streamystats-user"); // Clean up legacy cookie

    return response;
  }

  const session = sessionResult.data;

  // If the user is trying to access a server they are not a member of
  if (id && session.serverId !== Number(id)) {
    return NextResponse.redirect(
      new URL(`${basePath}/servers/${id}/login`, request.url),
    );
  }

  // Admin status is stored in the signed session (tamper-proof)
  const isAdmin = session.isAdmin;

  // Check if user is trying to access another users page (/servers/{x}/users/[userId])
  if (name && name !== session.id && !isAdmin) {
    return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
  }

  // Check admin permission for user sub-paths (e.g., /users/:id/security)
  if (
    userSubPage &&
    ADMIN_ONLY_USER_SUB_PATHS.includes(userSubPage) &&
    !isAdmin
  ) {
    return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
  }

  // Check admin permission for restricted paths
  if (page && !name && ADMIN_ONLY_PATHS.includes(page) && !isAdmin) {
    return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
  }

  // Check admin permission for restricted sub-paths (e.g., /dashboard/security)
  if (
    page &&
    subPage &&
    ADMIN_ONLY_SUB_PATHS[page]?.includes(subPage) &&
    !isAdmin
  ) {
    return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
  }

  // Allow the request to proceed
  return NextResponse.next();
}
