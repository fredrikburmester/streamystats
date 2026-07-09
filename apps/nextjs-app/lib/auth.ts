"use server";

import "server-only";

import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";
import { getServerWithSecrets } from "./db/server";
import { parseDeviceName } from "./device";
import { jellyfinHeaders } from "./jellyfin-auth";
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
}): Promise<void> => {
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

  const data = await res.json();

  await setToken(data, serverId);
};

async function setToken(data: any, serverId: number) {
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
}

// function to request a quickconnect code using a simple post request and return it to a client
export const initiateQuickConnect = async ({
  serverId,
  userAgent,
}: {
  serverId: number;
  userAgent: string;
}) => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });
  if (!server) {
    throw new Error("Server not found");
  }

  const device = {
    id: crypto.randomUUID(),
    name: userAgent ? parseDeviceName(userAgent) : "Streamystats Web",
  };

  const res = await fetch(`${getInternalUrl(server)}/QuickConnect/Initiate`, {
    method: "POST",
    headers: jellyfinHeaders(server.apiKey, device),
  });

  if (!res.ok) {
    throw new Error(
      "Failed to generate Quick Connect code. Maybe it's disabled on this server?",
    );
  }

  const decoded = await res.json();

  // Return the secret and device info to the client so it can poll using verifyQuickConnect
  return {
    code: decoded.Code,
    secret: decoded.Secret,
    device,
  };
};
// function that the client polls every 3 seconds to check the status of the code
export const verifyQuickConnect = async ({
  serverId,
  secret,
  device,
}: {
  serverId: number;
  secret: string;
  device: { id: string; name: string };
}) => {
  const server = await getServerWithSecrets({ serverId: serverId.toString() });
  if (!server) {
    throw new Error("Server not found");
  }

  // try to get token
  const res = await fetch(
    `${getInternalUrl(server)}/Users/AuthenticateWithQuickConnect`,
    {
      method: "POST",
      headers: jellyfinHeaders(server.apiKey, device),
      body: JSON.stringify({ Secret: secret }),
    },
  );

  // 200 = login succeeded, anything else = nothing yet
  if (res.status === 200) {
    const decoded = await res.json();

    // return to client
    await setToken(decoded, serverId);
    return { authenticated: true };
  }

  return { authenticated: false };
};
