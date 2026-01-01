import { createHash } from "crypto";

// Constants
export const STREAMYSTATS_CLIENT = "Streamystats";
export const STREAMYSTATS_VERSION = "2.16.0";

/**
 * Configuration for building MediaBrowser auth header
 */
export interface MediaBrowserConfig {
  token: string;
  client?: string;
  device?: string;
  deviceId?: string;
  version?: string;
}

/**
 * Options for building auth headers
 */
export interface BuildAuthHeadersOptions {
  serverId?: number | string;
  appContext?: "web" | "job-server";
}

/**
 * Auth headers returned by buildAuthHeaders
 * Uses index signature for compatibility with fetch headers
 */
export type AuthHeaders = {
  "Content-Type": string;
  Authorization?: string;
  "X-Emby-Token"?: string;
} & Record<string, string>;

/**
 * Parsed Jellyfin version
 */
export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a Jellyfin version string into components
 * @param version - Version string like "10.11.0" or "10.9.11"
 */
export function parseJellyfinVersion(version: string): ParsedVersion {
  const parts = version.split(".");
  return {
    major: Number.parseInt(parts[0] ?? "0", 10) || 0,
    minor: Number.parseInt(parts[1] ?? "0", 10) || 0,
    patch: Number.parseInt(parts[2] ?? "0", 10) || 0,
  };
}

/**
 * Check if a Jellyfin version supports the new MediaBrowser authentication
 * Jellyfin 10.11+ supports the new auth format
 * @param version - Version string or null
 */
export function supportsMediaBrowserAuth(version: string | null): boolean {
  if (!version) return false;
  const parsed = parseJellyfinVersion(version);
  return parsed.major > 10 || (parsed.major === 10 && parsed.minor >= 11);
}

/**
 * Generate a deterministic device ID for a given context
 * Uses SHA256 hash of context string, returns first 32 chars
 * @param appContext - "web" or "job-server"
 * @param serverId - Optional server ID for per-server uniqueness
 */
export function generateDeviceId(
  appContext: "web" | "job-server",
  serverId?: number | string
): string {
  const input = `streamystats-${appContext}-${serverId ?? "global"}`;
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

/**
 * Get device name for the current context
 * @param appContext - "web" or "job-server"
 */
export function getDeviceName(appContext: "web" | "job-server"): string {
  if (appContext === "job-server") {
    return process.env.HOSTNAME ?? "Streamystats-JobServer";
  }
  return "Streamystats-Web";
}

/**
 * Build a MediaBrowser authorization header value
 * Format: MediaBrowser Token="...", Client="...", Device="...", DeviceId="...", Version="..."
 * @param config - Configuration with token and optional client info
 */
export function buildMediaBrowserHeader(config: MediaBrowserConfig): string {
  const client = config.client ?? STREAMYSTATS_CLIENT;
  const device = config.device ?? "Streamystats";
  const deviceId = config.deviceId ?? generateDeviceId("web");
  const version = config.version ?? STREAMYSTATS_VERSION;

  // URL encode values that might contain special characters
  const encodeValue = (value: string): string =>
    encodeURIComponent(value).replace(/%20/g, " ");

  return `MediaBrowser Token="${encodeValue(config.token)}", Client="${encodeValue(client)}", Device="${encodeValue(device)}", DeviceId="${encodeValue(deviceId)}", Version="${encodeValue(version)}"`;
}

/**
 * Build auth headers for making requests to Jellyfin
 * Automatically selects between MediaBrowser and X-Emby-Token based on server version
 * @param token - API key or user access token
 * @param serverVersion - Jellyfin server version string or null
 * @param options - Additional options for device ID generation
 */
export function buildAuthHeaders(
  token: string,
  serverVersion: string | null,
  options?: BuildAuthHeadersOptions
): AuthHeaders {
  const appContext = options?.appContext ?? "web";

  if (supportsMediaBrowserAuth(serverVersion)) {
    const deviceId = generateDeviceId(appContext, options?.serverId);
    const device = getDeviceName(appContext);

    return {
      Authorization: buildMediaBrowserHeader({
        token,
        deviceId,
        device,
      }),
      "Content-Type": "application/json",
    };
  }

  // Legacy auth for older Jellyfin versions
  return {
    "X-Emby-Token": token,
    "Content-Type": "application/json",
  };
}
