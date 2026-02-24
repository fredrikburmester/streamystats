import { type NextRequest, NextResponse } from "next/server";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http: https:; font-src 'self' data:; connect-src 'self' http: https:; frame-ancestors 'none';",
};

/** Simple in-memory sliding-window rate limiter. */
const rateLimitMap = new Map<string, { timestamps: number[] }>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "/api/chat": { maxRequests: 20, windowMs: RATE_LIMIT_WINDOW_MS },
  "/api/search": { maxRequests: 60, windowMs: RATE_LIMIT_WINDOW_MS },
  "/api/import": { maxRequests: 5, windowMs: RATE_LIMIT_WINDOW_MS },
  "/login": { maxRequests: 10, windowMs: RATE_LIMIT_WINDOW_MS },
};

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 120,
  windowMs: RATE_LIMIT_WINDOW_MS,
};

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function getRateLimitConfig(pathname: string): RateLimitConfig {
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) {
      return config;
    }
  }
  // Rate limit login actions (POST to pages containing /login)
  if (pathname.includes("/login")) {
    return RATE_LIMITS["/login"];
  }
  return DEFAULT_RATE_LIMIT;
}

function isRateLimited(
  key: string,
  config: RateLimitConfig,
): { limited: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry) {
    rateLimitMap.set(key, { timestamps: [now] });
    return { limited: false, remaining: config.maxRequests - 1 };
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < config.windowMs,
  );

  if (entry.timestamps.length >= config.maxRequests) {
    return { limited: true, remaining: 0 };
  }

  entry.timestamps.push(now);
  return {
    limited: false,
    remaining: config.maxRequests - entry.timestamps.length,
  };
}

// Periodic cleanup of stale entries
let lastCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < RATE_LIMIT_CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitMap) {
    entry.timestamps = entry.timestamps.filter(
      (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
    );
    if (entry.timestamps.length === 0) {
      rateLimitMap.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  cleanupRateLimitMap();

  const { pathname } = request.nextUrl;

  // Only rate-limit API routes, login pages, and import endpoints
  const shouldRateLimit =
    pathname.startsWith("/api/") || pathname.includes("/login");

  if (shouldRateLimit) {
    const ip = getClientIp(request);
    const config = getRateLimitConfig(pathname);
    const rateLimitKey = `${ip}:${pathname.split("/").slice(0, 4).join("/")}`;
    const { limited, remaining } = isRateLimited(rateLimitKey, config);

    if (limited) {
      return new NextResponse(
        JSON.stringify({ error: "Too many requests. Please try again later." }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "60",
            ...SECURITY_HEADERS,
          },
        },
      );
    }

    const response = NextResponse.next();
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      response.headers.set(key, value);
    }
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Limit", String(config.maxRequests));
    return response;
  }

  // Non-rate-limited routes still get security headers
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
