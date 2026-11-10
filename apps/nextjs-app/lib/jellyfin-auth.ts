import { STREAMYSTATS_VERSION } from "@/lib/version";

export type JellyfinDevice = { id: string; name: string };

/**
 * Build the standard Jellyfin Authorization header.
 * Uses MediaBrowser format required by Jellyfin 10.12+ (non-legacy auth).
 */
export function jellyfinHeaders(
  token: string,
  device?: JellyfinDevice,
): Record<string, string> {
  return {
    Authorization: `${mediaBrowserIdentity(device)}, Token="${token}"`,
    "Content-Type": "application/json",
  };
}

/**
 * Authorization header for requests made before a token exists. Jellyfin
 * rejects /Users/AuthenticateByName with HTTP 400 unless the client identifies
 * itself with Client, Device, DeviceId and Version.
 */
export function jellyfinClientHeaders(
  device: JellyfinDevice,
): Record<string, string> {
  return {
    Authorization: mediaBrowserIdentity(device),
    "Content-Type": "application/json",
  };
}

function mediaBrowserIdentity(device?: JellyfinDevice): string {
  const devicePart = device
    ? `, Device="${device.name}", DeviceId="${device.id}"`
    : "";
  return `MediaBrowser Client="Streamystats"${devicePart}, Version="${STREAMYSTATS_VERSION}"`;
}

/**
 * Stable device identity for password logins through the external API, so
 * repeated calls reuse one Jellyfin device per user instead of creating a new
 * device entry every time.
 */
export function apiLoginDevice(username: string): JellyfinDevice {
  const slug = encodeURIComponent(username.trim().toLowerCase());
  return { id: `streamystats-api-${slug}`, name: "Streamystats API" };
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

type JellyfinApiKeysResponse = {
  Items?: Array<{ AccessToken?: string }>;
};

export type JellyfinAuthUser = {
  id: string;
  name: string | null;
  isAdmin: boolean;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, error: "Invalid Authorization header" };
      }
      return { ok: false, error: `Jellyfin returned ${res.status}` };
    }

    const json = (await res.json()) as JellyfinUserMeResponse;
    const id = asNonEmptyString(json.Id);
    if (!id) return { ok: false, error: "Jellyfin did not return a user id" };
    const name = asNonEmptyString(json.Name);

    // API Keys don't return Policy in Users/Me usually, but if it's a user token it might.
    // However, if we are here, it's a User Token.
    const isAdmin = json.Policy?.IsAdministrator ?? false;

    return { ok: true, user: { id, name, isAdmin } };
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

/**
 * Whether the token is one of the server's own API keys rather than a user
 * access token. A 200 from an authenticated endpoint like /System/Info can't
 * tell the two apart, since Jellyfin answers it for any signed-in user.
 * /Auth/Keys only answers administrators and API keys, and the token must be
 * in the list it returns, so no user token passes: a regular user is refused
 * and an administrator's token is not listed.
 */
export async function isServerApiKey(args: {
  serverUrl: string;
  token: string;
}): Promise<boolean> {
  if (!args.token) return false;

  try {
    const res = await fetch(`${normalizeBaseUrl(args.serverUrl)}/Auth/Keys`, {
      method: "GET",
      headers: jellyfinHeaders(args.token),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;

    const json = (await res.json()) as JellyfinApiKeysResponse;
    return (
      Array.isArray(json.Items) &&
      json.Items.some((key) => key.AccessToken === args.token)
    );
  } catch {
    return false;
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
      headers: jellyfinClientHeaders(apiLoginDevice(username)),
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
