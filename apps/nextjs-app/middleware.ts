import { basePath } from "@/lib/utils";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getServers } from "./lib/server";
import { eq, and } from "drizzle-orm";
import { db, User, users } from "@streamystats/database";
import { getServer } from "./lib/db/server";

/**
 * Enhanced Middleware with Dual Authentication Validation
 *
 * This middleware provides comprehensive authentication and authorization for the Streamystats application.
 * It performs both local database validation and live Jellyfin server validation to ensure security.
 *
 * Key Security Features:
 * 1. **Dual Validation**: Checks both local database and live Jellyfin server for user validity
 * 2. **Token Verification**: Validates access tokens against the actual Jellyfin server using /Users/Me endpoint
 * 3. **Account Status Checks**: Verifies users are not disabled in either local DB or Jellyfin server
 * 4. **Server Connectivity Handling**: Gracefully handles server connectivity issues with appropriate headers
 * 5. **Automatic Cookie Cleanup**: Removes invalid cookies when authentication fails
 *
 * Authentication Flow:
 * 1. Check if user exists in local database
 * 2. Verify user is not disabled locally
 * 3. Validate access token against Jellyfin server
 * 4. Confirm user ID matches and account is active on Jellyfin
 * 5. Clear cookies and redirect to login if any validation fails
 *
 * Error Handling:
 * - Server connectivity issues: Allow access but set warning headers
 * - Invalid/expired tokens: Clear cookies and redirect to login
 * - Disabled accounts: Deny access and redirect to login
 * - Network timeouts: Distinguish between auth failures and connectivity issues
 */

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
  runtime: "nodejs",
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

const ADMIN_ONLY_PATHS = ["history", "settings", "activities", "users", "setup"];
const PUBLIC_PATHS = ["login"];

const BASE_PATH_REGEX = basePath.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');

/**
 * Parse URL pathname to extract server ID, page, and user name
 */
const parsePathname = (pathname: string) => {
  const segments = basePath
    ? pathname.replace(new RegExp(`^${BASE_PATH_REGEX}`), '').split("/").filter(Boolean)
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

    // Handle /servers/:id/users/:name
    if (page === "users" && segments[3]) {
      return { id, page, name: segments[3] };
    }

    // Handle /servers/:id/items/:itemId
    if (page === "items" && segments[3]) {
      return { id, page, itemId: segments[3] };
    }

    // Handle /servers/:id/:page
    return { id, page };
  }

  return {};
};

const getMe = async (request: NextRequest): Promise<Result<User>> => {
  const userCookie = request.cookies.get("streamystats-user");

  try {
    const me = userCookie?.value ? JSON.parse(userCookie.value) : undefined;
    if (me?.name && me.serverId) {
      const authResult = await validateUserAuth(request, me);
      if (authResult.type === ResultType.Success) {
        return {
          type: ResultType.Success,
          data: me,
        };
      } else if (authResult.type === ResultType.ServerConnectivityError) {
        return {
          type: ResultType.ServerConnectivityError,
          error: authResult.error,
        };
      }
      return {
        type: ResultType.Error,
        error: "Invalid user cookie",
      };
    }

    console.warn("Missing required fields in cookie");
  } catch (e) {
    console.error(
      "Failed to parse user cookie. The cookie probably has incorrect information.",
      e
    );
  }

  return {
    type: ResultType.Error,
    error: "Invalid user cookie",
  };
};

const isUserAdmin = async (
  request: NextRequest,
  me: User
): Promise<Result<boolean>> => {
  try {
    // Query the database directly instead of making an API call
    const userResult = await db
      .select()
      .from(users)
      .where(and(eq(users.id, me.id), eq(users.serverId, me.serverId)))
      .limit(1);

    if (userResult.length === 0) {
      return {
        type: ResultType.Error,
        error: "User not found in database",
      };
    }

    const user = userResult[0];

    // Return true if user has admin role/privileges
    return {
      type: ResultType.Success,
      data: user.isAdministrator === true,
    };
  } catch (e) {
    console.error("Failed to check if user is admin", e);

    // Check if it's a database connectivity issue
    if (
      e instanceof Error &&
      (e.message.includes("connection") ||
        e.message.includes("timeout") ||
        e.message.includes("ECONNREFUSED") ||
        e.message.includes("ENOTFOUND"))
    ) {
      return {
        type: ResultType.ServerConnectivityError,
        error: "Database connectivity issue",
      };
    }

    return {
      type: ResultType.Error,
      error: "Failed to verify admin status",
    };
  }
};

/**
 * @param me The user object from the cookie
 * Validates that the user stored in the cookie is valid and has access to the server.
 * This includes both database validation and actual Jellyfin server validation.
 */
const validateUserAuth = async (
  request: NextRequest,
  me: User
): Promise<Result<boolean>> => {
  try {
    // First check if user exists in local database
    const userResult = await db
      .select()
      .from(users)
      .where(and(eq(users.id, me.id), eq(users.serverId, me.serverId)))
      .limit(1);

    if (userResult.length === 0) {
      return {
        type: ResultType.Error,
        error: "User not found in server",
      };
    }

    const user = userResult[0];

    // If user is disabled in our database, deny access
    if (user.isDisabled) {
      return {
        type: ResultType.Error,
        error: "User account is disabled",
      };
    }

    // Get the access token from cookies
    const tokenCookie = request.cookies.get("streamystats-token");
    if (!tokenCookie?.value) {
      return {
        type: ResultType.Error,
        error: "No access token found",
      };
    }

    // Get server information to make the validation request
    const server = await getServer({ serverId: me.serverId.toString() });
    if (!server) {
      return {
        type: ResultType.Error,
        error: "Server not found",
      };
    }

    // Validate the user token against the actual Jellyfin server
    try {
      const jellyfinResponse = await fetch(`${server.url}/Users/Me`, {
        method: "GET",
        headers: {
          "X-Emby-Token": tokenCookie.value,
          "Content-Type": "application/json",
        },
        // Short timeout to avoid hanging requests in middleware
        signal: AbortSignal.timeout(5000),
      });

      if (!jellyfinResponse.ok) {
        // Token is invalid or expired
        if (jellyfinResponse.status === 401) {
          return {
            type: ResultType.Error,
            error: "Access token is invalid or expired",
          };
        }
        // Other errors indicate server issues
        return {
          type: ResultType.ServerConnectivityError,
          error: `Jellyfin server returned ${jellyfinResponse.status}`,
        };
      }

      const jellyfinUser = await jellyfinResponse.json();

      // Verify the user ID matches what we expect
      if (jellyfinUser.Id !== me.id) {
        return {
          type: ResultType.Error,
          error: "User ID mismatch",
        };
      }

      // Check if the user is disabled on the Jellyfin server
      if (jellyfinUser.IsDisabled) {
        return {
          type: ResultType.Error,
          error: "User account is disabled on Jellyfin server",
        };
      }

      return { type: ResultType.Success, data: true };
    } catch (error) {
      console.error(
        "Failed to validate user token with Jellyfin server",
        error
      );

      // Check if it's a network/connectivity issue
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
        error: "Failed to verify user authentication with Jellyfin server",
      };
    }
  } catch (e) {
    console.error("Failed to validate user auth", e);

    // Check if it's a database connectivity issue
    if (
      e instanceof Error &&
      (e.message.includes("connection") ||
        e.message.includes("timeout") ||
        e.message.includes("ECONNREFUSED") ||
        e.message.includes("ENOTFOUND"))
    ) {
      return {
        type: ResultType.ServerConnectivityError,
        error: "Database connectivity issue",
      };
    }

    return {
      type: ResultType.Error,
      error: "Failed to verify user authentication",
    };
  }
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { id, page, name } = parsePathname(pathname);

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

  // Get user from cookies if exists
  const meResult = await getMe(request);

  // Handle server connectivity error
  if (meResult.type === ResultType.ServerConnectivityError) {
    console.warn("Server connectivity issue detected.", meResult.error);
    // Add a header to indicate server connectivity issues - will be used by the client to show a toast
    const response = NextResponse.next();
    response.headers.set("x-server-connectivity-error", "true");
    return response;
  }

  // If the user is not logged in or has invalid credentials
  if (meResult.type === ResultType.Error) {
    console.error(
      "User authentication failed, removing cookies.",
      meResult.error
    );
    const redirectUrl = id
      ? new URL(`${basePath}/servers/${id}/login`, request.url)
      : new URL(`${basePath}/servers/${servers[0].id}/login`, request.url);

    const response = NextResponse.redirect(redirectUrl);

    // Clear invalid cookies
    response.cookies.delete("streamystats-user");
    response.cookies.delete("streamystats-token");

    return response;
  }

  // If the user is trying to access a server they are not a member of
  if (meResult.type === ResultType.Success && id) {
    if (Number(meResult.data.serverId) !== Number(id)) {
      console.warn(
        "User is trying to access a server they are not a member of"
      );
      return NextResponse.redirect(
        new URL(`${basePath}/servers/${id}/login`, request.url)
      );
    }

    const adminResult = await isUserAdmin(request, meResult.data);

    // Handle server connectivity error when checking admin status
    if (adminResult.type === ResultType.ServerConnectivityError) {
      console.warn("Server connectivity issue detected.", adminResult.error);
      // Add a header to indicate server connectivity issues
      const response = NextResponse.next();
      response.headers.set("x-server-connectivity-error", "true");
      return response;
    }

    const isAdmin =
      adminResult.type === ResultType.Success ? adminResult.data : false;

    // Check if user is trying to access another users page (/servers/{x}/users/[name])
    if (name && (name !== meResult.data.name && !isAdmin)) {
          return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
    }

    // Check admin permission for restricted paths
    if (page && !name && ADMIN_ONLY_PATHS.includes(page) && !isAdmin) {
          return NextResponse.redirect(new URL(`${basePath}/not-found`, request.url));
    }
  }

  // For all other cases, allow the request to proceed
  return NextResponse.next();
}
