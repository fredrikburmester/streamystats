/**
 * Shared session secret utility.
 *
 * Used by both the session library and the middleware proxy to ensure
 * consistent JWT signing and verification.
 */
export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "development") {
      throw new Error(
        "SESSION_SECRET environment variable is required outside of local development",
      );
    }
    return new TextEncoder().encode("fallback-dev-secret-change-in-production");
  }
  return new TextEncoder().encode(secret);
}
