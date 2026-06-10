import { headers } from "next/headers";

const MAX_RATE_LIMIT_KEYS = 10_000;

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  message: string;
}

interface RateLimiter {
  /** Throws if the key+ip combo exceeds the rate limit. */
  enforce(key: string, ip: string): void;
  /** Returns true if the request is allowed, false if rate-limited. */
  check(key: string, ip: string): boolean;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const timestamps = new Map<string, number[]>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, ts] of timestamps) {
      const recent = ts.filter((t) => now - t < opts.windowMs);
      if (recent.length === 0) timestamps.delete(key);
      else timestamps.set(key, recent);
    }
  }, 5 * 60_000).unref();

  function tryRecord(compositeKey: string, ip: string): boolean {
    const now = Date.now();
    const recent = (timestamps.get(compositeKey) ?? []).filter(
      (t) => now - t < opts.windowMs,
    );
    const effectiveLimit =
      ip === "unknown" ? Math.max(1, Math.floor(opts.limit / 5)) : opts.limit;
    if (recent.length >= effectiveLimit) return false;
    if (
      !timestamps.has(compositeKey) &&
      timestamps.size >= MAX_RATE_LIMIT_KEYS
    ) {
      return false;
    }
    recent.push(now);
    timestamps.set(compositeKey, recent);
    return true;
  }

  return {
    enforce(key: string, ip: string): void {
      if (!tryRecord(`${key}:${ip}`, ip)) {
        throw new Error(opts.message);
      }
    },
    check(key: string, ip: string): boolean {
      return tryRecord(`${key}:${ip}`, ip);
    },
  };
}

/**
 * Async — reads `x-forwarded-for` from Next.js `headers()`.
 * Use in server actions / server components.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Sync — reads `x-forwarded-for` from a raw `Request`.
 * Use in API route handlers.
 */
export function getClientIpFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}
