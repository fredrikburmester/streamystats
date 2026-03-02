"use server";

import "server-only";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { getServer, getServerWithSecrets } from "./db/server";
import {
  authenticateWithQuickConnect,
  checkQuickConnectEnabled,
  initiateQuickConnect,
  jellyfinHeaders,
} from "./jellyfin-auth";
import { createRateLimiter, getClientIp } from "./rate-limit";
import { getInternalUrl } from "./server-url";
import { createSession } from "./session";

const qcInitLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60_000,
  message: "Too many QuickConnect attempts. Please try again later.",
});

const qcCompleteLimiter = createRateLimiter({
  limit: 5,
  windowMs: 60_000,
  message: "Too many QuickConnect attempts. Please try again later.",
});

const loginLimiter = createRateLimiter({
  limit: 10,
  windowMs: 60_000,
  message: "Too many login attempts. Please try again later.",
});

export const login = async ({
  serverId,
  username,
  password,
}: {
  serverId: number;
  username: string;
  password?: string | null;
}): Promise<void> => {
  const clientIp = await getClientIp();
  loginLimiter.enforce(String(serverId), clientIp);

  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  if (server.disablePasswordLogin) {
    const qcAvailable = await checkQuickConnectEnabled({
      serverUrl: getInternalUrl(server),
    });
    if (qcAvailable) {
      throw new Error("Password login is disabled for this server");
    }
  }

  const res = await fetch(
    `${getInternalUrl(server)}/Users/AuthenticateByName`,
    {
      method: "POST",
      headers: jellyfinHeaders(server.apiKey),
      body: JSON.stringify({ Username: username, Pw: password }),
    },
  );

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  const data = await res.json();

  const accessToken = data.AccessToken;
  const user = data.User;
  const isAdmin = user.Policy.IsAdministrator;

  const secure = await shouldUseSecureCookies();
  const maxAge = 30 * 24 * 60 * 60;

  // Create signed session (tamper-proof)
  await createSession({
    id: user.Id,
    name: user.Name,
    serverId,
    isAdmin,
  });

  // Store Jellyfin access token separately for API calls
  const c = await cookies();
  c.set("streamystats-token", accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });
};

export const initiateQuickConnectLogin = async ({
  serverId,
}: {
  serverId: number;
}): Promise<
  { ok: true; secret: string; code: string } | { ok: false; error: string }
> => {
  try {
    const clientIp = await getClientIp();
    qcInitLimiter.enforce(String(serverId), clientIp);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Rate limited",
    };
  }

  const server = await getServer({ serverId });
  if (!server) {
    return { ok: false, error: "Server not found" };
  }

  const result = await initiateQuickConnect({
    serverUrl: getInternalUrl(server),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, secret: result.secret, code: result.code };
};

export const loginWithQuickConnect = async ({
  serverId,
  secret,
}: {
  serverId: number;
  secret: string;
}): Promise<void> => {
  const clientIp = await getClientIp();
  qcCompleteLimiter.enforce(String(serverId), clientIp);

  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    throw new Error("Invalid QuickConnect secret");
  }

  const server = await getServer({ serverId });
  if (!server) {
    throw new Error("Server not found");
  }

  const result = await authenticateWithQuickConnect({
    serverUrl: getInternalUrl(server),
    secret,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  if (!result.accessToken) {
    throw new Error("Jellyfin did not return an access token");
  }

  const secure = await shouldUseSecureCookies();
  const maxAge = 30 * 24 * 60 * 60;

  await createSession({
    id: result.user.id,
    name: result.user.name ?? "",
    serverId,
    isAdmin: result.user.isAdmin,
  });

  const c = await cookies();
  c.set("streamystats-token", result.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });
};
