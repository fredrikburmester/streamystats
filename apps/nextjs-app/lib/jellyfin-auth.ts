const STREAMYSTATS_VERSION = "2.16.0"; // x-release-please-version

/**
 * Build the standard Jellyfin Authorization header.
 * Uses MediaBrowser format required by Jellyfin 10.12+ (non-legacy auth).
 */
export function jellyfinHeaders(
  token: string,
  device?: { id: string; name: string },
): Record<string, string> {
  const devicePart = device
    ? `, Device="${device.name}", DeviceId="${device.id}"`
    : "";
  return {
    Authorization: `MediaBrowser Client="Streamystats"${devicePart}, Version="${STREAMYSTATS_VERSION}", Token="${token}"`,
    "Content-Type": "application/json",
  };
}

type JellyfinUserMeResponse = {
  Id?: string;
  Name?: string;
  Policy?: {
    IsAdministrator?: boolean;
  };
};

type JellyfinAuthenticateByNameResponse = {
  AccessToken?: string;
  ServerId?: string;
  User?: {
    Id?: string;
    Name?: string;
    Policy?: {
      IsAdministrator?: boolean;
    };
  };
};

export type JellyfinAuthUser = {
  id: string;
  name: string | null;
  isAdmin: boolean;
};

// Pseudo-user surfaced when a request authenticates with a server API key.
export const SYSTEM_API_KEY_USER_ID = "system-api-key";
export const SYSTEM_API_KEY_USER_NAME = "System API Key";

export const JELLYFIN_REQUEST_TIMEOUT_MS = 5000;

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isTransientJellyfinStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

// NOTE: /System/Info accepts ANY non-guest token (incl. regular users), not just
// API keys — only treat `true` as "admin API key" after /Users/Me has rejected it.
export async function isValidJellyfinApiKey(
  serverUrl: string,
  token: string,
): Promise<boolean> {
  try {
    const sysRes = await fetch(`${normalizeBaseUrl(serverUrl)}/System/Info`, {
      method: "GET",
      headers: jellyfinHeaders(token.trim()),
      signal: AbortSignal.timeout(JELLYFIN_REQUEST_TIMEOUT_MS),
    });
    return sysRes.ok;
  } catch {
    return false;
  }
}

export async function getUserFromEmbyToken(args: {
  serverUrl: string;
  token: string;
}): Promise<
  { ok: true; user: JellyfinAuthUser } | { ok: false; error: string }
> {
  const serverUrl = normalizeBaseUrl(args.serverUrl);
  const token = args.token.trim();
  if (!token) return { ok: false, error: "Empty Authorization header" };

  try {
    const res = await fetch(`${serverUrl}/Users/Me`, {
      method: "GET",
      headers: jellyfinHeaders(token),
      signal: AbortSignal.timeout(JELLYFIN_REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      // Server API keys have no user context → 400 here (not 401); probe as a key unless transient.
      if (
        !isTransientJellyfinStatus(res.status) &&
        (await isValidJellyfinApiKey(serverUrl, token))
      ) {
        return {
          ok: true,
          user: {
            id: SYSTEM_API_KEY_USER_ID,
            name: SYSTEM_API_KEY_USER_NAME,
            isAdmin: true,
          },
        };
      }
      if (res.status === 401) {
        return { ok: false, error: "Invalid Authorization header" };
      }
      return { ok: false, error: `Jellyfin returned ${res.status}` };
    }

    const json = (await res.json()) as JellyfinUserMeResponse;
    const id = asNonEmptyString(json.Id);
    if (!id) return { ok: false, error: "Jellyfin did not return a user id" };
    const name = asNonEmptyString(json.Name);
    const isAdmin = json.Policy?.IsAdministrator ?? false;

    return { ok: true, user: { id, name, isAdmin } };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Jellyfin request timed out" };
    }
    // Network error: don't probe /System/Info (also unreachable) — let the caller retry.
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Jellyfin request failed",
    };
  }
}

export async function authenticateByName(args: {
  serverUrl: string;
  username: string;
  password: string;
}): Promise<
  | { ok: true; user: JellyfinAuthUser; accessToken: string | null }
  | { ok: false; error: string }
> {
  const serverUrl = normalizeBaseUrl(args.serverUrl);
  const username = args.username.trim();
  const password = args.password;

  if (!username || !password) {
    return { ok: false, error: "Username and password are required" };
  }

  try {
    const res = await fetch(`${serverUrl}/Users/AuthenticateByName`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Username: username, Pw: password }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, error: "Invalid username or password" };
      }
      return { ok: false, error: `Jellyfin returned ${res.status}` };
    }

    const json = (await res.json()) as JellyfinAuthenticateByNameResponse;
    const id = asNonEmptyString(json.User?.Id);
    if (!id) return { ok: false, error: "Jellyfin did not return a user id" };
    const name = asNonEmptyString(json.User?.Name);
    const accessToken = asNonEmptyString(json.AccessToken);
    const isAdmin = json.User?.Policy?.IsAdministrator ?? false;

    return { ok: true, user: { id, name, isAdmin }, accessToken };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Jellyfin request timed out" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Jellyfin request failed",
    };
  }
}
