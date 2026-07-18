"use strict";
/**
 * Helper functions for resolving Jellyfin server URLs.
 *
 * - Internal URL: Used for server-to-server requests (job-server, API routes, Next.js Image optimization)
 * - External URL: Used for client browser access (Jellyfin Web UI links)
 *
 * This module is dependency-free so it is safe to import from browser bundles.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInternalUrl = getInternalUrl;
exports.getExternalUrl = getExternalUrl;
/**
 * Get the internal URL for server-to-server requests.
 * Falls back to the external URL if no internal URL is configured.
 */
function getInternalUrl(server) {
    return server.internalUrl || server.url;
}
/**
 * Get the external URL for client browser access.
 */
function getExternalUrl(server) {
    return server.url;
}
//# sourceMappingURL=server-url.js.map