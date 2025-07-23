"use server";

import { cookies, headers } from "next/headers";
import { getServer, authenticateJellyseerr } from "./db/server";

export const login = async ({
  serverId,
  username,
  password,
}: {
  serverId: number;
  username: string;
  password?: string | null;
}): Promise<void> => {
  // Make login request to jellyfin server directly
  const server = await getServer({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  const res = await fetch(`${server.url}/Users/AuthenticateByName`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Emby-Token": server.apiKey,
    },
    body: JSON.stringify({ Username: username, Pw: password }),
  });

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  const data = await res.json();

  const accessToken = data["AccessToken"];
  const user = data["User"];

  const h = await headers();

  const secure = h.get("x-forwarded-proto") === "https";

  const maxAge = 30 * 24 * 60 * 60;

  const isAdmin = data["User"]["Policy"]["IsAdministrator"];

  const c = await cookies();

  c.set("streamystats-token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });

  c.set(
    "streamystats-user",
    JSON.stringify({
      name: user.Name,
      id: user.Id,
      serverId,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge,
      secure,
    }
  );

  c.set("show-admin-statistics", isAdmin ? "true" : "false", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });

  // Attempt to authenticate with Jellyseerr if integration is enabled
  // This is done asynchronously and won't block login if it fails
  if (password) {
    try {
      const jellyseerrResult = await authenticateJellyseerr({
        serverId,
        username,
        password,
      });

      if (jellyseerrResult.success && jellyseerrResult.sessionData) {
        // Store Jellyseerr session data in cookies
        c.set(
          "jellyseerr-session",
          JSON.stringify({
            cookies: jellyseerrResult.sessionData.cookies,
            user: jellyseerrResult.sessionData.user,
          }),
          {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
            maxAge,
            secure,
          }
        );

        console.log(
          "Successfully authenticated with Jellyseerr for user:",
          username
        );
      } else {
        console.log(
          "Jellyseerr authentication skipped:",
          jellyseerrResult.reason
        );
      }
    } catch (error) {
      console.warn(
        "Jellyseerr authentication failed, but login continues:",
        error
      );
    }
  }
};

// Jellyseerr session management
export interface JellyseerrSessionData {
  cookies: string[];
  user: any;
}

export const getJellyseerrSession =
  async (): Promise<JellyseerrSessionData | null> => {
    try {
      const c = await cookies();
      const sessionCookie = c.get("jellyseerr-session");

      if (!sessionCookie?.value) {
        return null;
      }

      const sessionData = JSON.parse(
        sessionCookie.value
      ) as JellyseerrSessionData;
      return sessionData;
    } catch (error) {
      console.error("Failed to parse Jellyseerr session data:", error);
      return null;
    }
  };

export const setJellyseerrSession = async (
  sessionData: JellyseerrSessionData
): Promise<void> => {
  const c = await cookies();
  const h = await headers();
  const secure = h.get("x-forwarded-proto") === "https";
  const maxAge = 30 * 24 * 60 * 60; // 30 days

  c.set("jellyseerr-session", JSON.stringify(sessionData), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });
};

export const clearJellyseerrSession = async (): Promise<void> => {
  const c = await cookies();
  c.delete("jellyseerr-session");
};

// Helper function to extract XSRF token from cookies (not a server action)
const getJellyseerrXsrfToken = (cookies: string[]): string | null => {
  const xsrfCookie = cookies.find((cookie) => cookie.includes("XSRF-TOKEN="));
  if (xsrfCookie) {
    const match = xsrfCookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? match[1] : null;
  }
  return null;
};
