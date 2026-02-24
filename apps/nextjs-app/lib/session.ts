"use server";

import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { shouldUseSecureCookies } from "@/lib/secure-cookies";

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET environment variable is required in production",
      );
    }
    return new TextEncoder().encode("fallback-dev-secret-change-in-production");
  }
  return new TextEncoder().encode(secret);
}

const SECRET = getSessionSecret();

const SESSION_COOKIE = "streamystats-session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export interface SessionUser {
  id: string;
  name: string;
  serverId: number;
  isAdmin: boolean;
}

interface SessionPayload extends JWTPayload {
  id: string;
  name: string;
  serverId: number;
  isAdmin: boolean;
}

/**
 * Creates a signed session cookie containing user information.
 * The JWT signature ensures the cookie cannot be tampered with.
 */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({
    id: user.id,
    name: user.name,
    serverId: user.serverId,
    isAdmin: user.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);

  const c = await cookies();
  const secure = await shouldUseSecureCookies();

  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure,
  });
}

/**
 * Retrieves and validates the session from the signed cookie.
 * Returns null if the session is missing, expired, or tampered with.
 */
export async function getSession(): Promise<SessionUser | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify<SessionPayload>(token, SECRET);

    return {
      id: payload.id,
      name: payload.name,
      serverId: payload.serverId,
      isAdmin: payload.isAdmin,
    };
  } catch {
    // Invalid signature, expired, or malformed token
    return null;
  }
}

/**
 * Destroys the session by removing all auth-related cookies.
 */
export async function destroySession(): Promise<void> {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
  c.delete("streamystats-token");
  c.delete("streamystats-user");
}

/**
 * Updates the session with new user information.
 * Useful for refreshing admin status after it changes on Jellyfin.
 */
export async function updateSession(
  updates: Partial<SessionUser>,
): Promise<void> {
  const current = await getSession();
  if (!current) {
    return;
  }

  await createSession({
    ...current,
    ...updates,
  });
}
