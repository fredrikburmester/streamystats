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
      headers: {
        "Authorization": `MediaBrowser Client="Streamystats", Token="${token}"`,
        "Content-Type": "application/json",
      },
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

    // If /Users/Me failed, it might be an API Key.
    // Try /System/Info to validate if it's a valid API Key.
    try {
      const sysRes = await fetch(
        `${normalizeBaseUrl(args.serverUrl)}/System/Info`,
        {
          method: "GET",
          headers: {
            "Authorization": `MediaBrowser Client="Streamystats", Token="${args.token.trim()}"`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (sysRes.ok) {
        // It is a valid API Key (Admin)
        return {
          ok: true,
          user: {
            id: "system-api-key",
            name: "System API Key",
            isAdmin: true,
          },
        };
      }
    } catch {
      // Ignore error from System/Info and return original error
    }

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
