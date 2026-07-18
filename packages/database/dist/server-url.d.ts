/**
 * Helper functions for resolving Jellyfin server URLs.
 *
 * - Internal URL: Used for server-to-server requests (job-server, API routes, Next.js Image optimization)
 * - External URL: Used for client browser access (Jellyfin Web UI links)
 *
 * This module is dependency-free so it is safe to import from browser bundles.
 */
/**
 * Get the internal URL for server-to-server requests.
 * Falls back to the external URL if no internal URL is configured.
 */
export declare function getInternalUrl(server: {
    url: string;
    internalUrl?: string | null;
}): string;
/**
 * Get the external URL for client browser access.
 */
export declare function getExternalUrl(server: {
    url: string;
}): string;
//# sourceMappingURL=server-url.d.ts.map