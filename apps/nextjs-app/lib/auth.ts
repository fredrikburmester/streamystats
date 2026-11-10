"use server";

import "server-only";
import { getMergedUserTarget } from "@streamystats/database";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { getServerWithSecrets } from "./db/server";
import { parseDeviceName } from "./device";
import { jellyfinClientHeaders, jellyfinHeaders } from "./jellyfin-auth";
import { getInternalUrl } from "./server-url";
import { createSession } from "./session";

export const login = async ({
  serverId,
  username,
  password,
  userAgent,
}: {
  serverId: number;
  username: string;
  password?: string | null;
  userAgent?: string;
}): Promise<{ error: string } | undefined> => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  // Each browser session gets a unique DeviceId so Jellyfin tracks them as
  // separate devices. Without this, re-authenticating revokes the previous
  // token and breaks multi-device sessions (#370).
  const device = {
    id: crypto.randomUUID(),
    name: userAgent ? parseDeviceName(userAgent) : "Streamystats Web",
  };

  const res = await fetch(
    `${getInternalUrl(server)}/Users/AuthenticateByName`,
    {
      method: "POST",
      headers: jellyfinHeaders(server.apiKey, device),
      body: JSON.stringify({ Username: username, Pw: password }),
    },
  );

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  return startSession(serverId, await res.json());
};

export const initiateQuickConnect = async ({
  serverId,
  userAgent,
}: {
  serverId: number;
  userAgent?: string;
}): Promise<{ code: string; secret: string }> => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  // Jellyfin binds the resulting access token to the device that initiates
  // the request, so this is the only call that needs the device identity.
  const res = await fetch(`${getInternalUrl(server)}/QuickConnect/Initiate`, {
    method: "POST",
    headers: jellyfinClientHeaders({
      id: crypto.randomUUID(),
      name: userAgent ? parseDeviceName(userAgent) : "Streamystats Web",
    }),
  });

  if (!res.ok) {
    throw new Error("Quick Connect is not enabled on this server");
  }

  const data = await res.json();
  return { code: data.Code, secret: data.Secret };
};

/**
 * Logs in once the user has approved the Quick Connect code in Jellyfin.
 * Returns false while the request is still pending, and an error when the
 * approved account is not allowed to sign in.
 */
export const loginWithQuickConnect = async ({
  serverId,
  secret,
}: {
  serverId: number;
  secret: string;
}): Promise<boolean | { error: string }> => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });

  if (!server) {
    throw new Error("Server not found");
  }

  const url = getInternalUrl(server);
  const state = await fetch(
    `${url}/QuickConnect/Connect?secret=${encodeURIComponent(secret)}`,
  );

  if (!state.ok) {
    throw new Error("Quick Connect request expired");
  }

  if (!(await state.json()).Authenticated) {
    return false;
  }

  const res = await fetch(`${url}/Users/AuthenticateWithQuickConnect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Secret: secret }),
  });

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  return (await startSession(serverId, await res.json())) ?? true;
};

const startSession = async (
  serverId: number,
  data: {
    AccessToken: string;
    User: { Id: string; Name: string; Policy: { IsAdministrator: boolean } };
  },
): Promise<{ error: string } | undefined> => {
  const accessToken = data.AccessToken;
  const user = data.User;
  if (await getMergedUserTarget({ serverId, userId: user.Id })) {
    return {
      error:
        "This Streamystats account was permanently merged. Sign in with the destination account.",
    };
  }
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
