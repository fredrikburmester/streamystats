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

/**
 * Identity surfaced when a request authenticates with a Jellyfin server
 * API key rather than a user access token. Shared by both auth paths
 * (`getUserFromEmbyToken` here and `validateJellyfinToken` in
 * `api-auth.ts`) so they stay in sync.
 */
export const SYSTEM_API_KEY_USER_ID = "system-api-key";
export const SYSTEM_API_KEY_USER_NAME = "System API Key";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * A failure that is the server's fault and likely to resolve on retry,
 * as opposed to a definitive rejection of the request/token. Used to
 * decide whether a non-OK `/Users/Me` is worth probing as an API key:
 * a transient failure should stay retryable rather than trigger a guess.
 */
export function isTransientJellyfinStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Returns true when `token` is accepted by `/System/Info` (200), false on
 * any non-OK response or network error.
 *
 * IMPORTANT: this is NOT an API-key-only check. `/System/Info` uses the
 * `FirstTimeSetupOrIgnoreParentalControl` policy, which any non-guest
 * principal satisfies — admins, server API keys (always Administrator),
 * AND regular users. It is therefore only safe to treat a `true` result
 * as "this is an admin API key" when the caller has already confirmed the
 * token is NOT a usable user access token (i.e. `/Users/Me` returned a
 * non-OK status first). A real user token returns 200 from `/Users/Me`
 * and must be resolved there, before this probe is reached.
 */
export async function isValidJellyfinApiKey(
  serverUrl: string,
  token: string,
): Promise<boolean> {
  try {
    const sysRes = await fetch(`${normalizeBaseUrl(serverUrl)}/System/Info`, {
      method: "GET",
      headers: jellyfinHeaders(token.trim()),
      signal: AbortSignal.timeout(5000),
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
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // A user access token always returns 200 above. A non-OK status
      // means this isn't a usable user token — but a server API key has
      // no user context and is rejected here (400 on current Jellyfin,
      // 401 on older versions). Probe it as an API key, unless the
      // failure is transient (429/5xx), which should stay retryable.
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
    // Network error: `/System/Info` is unreachable too, so don't probe —
    // surface the error and let the caller retry.
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
