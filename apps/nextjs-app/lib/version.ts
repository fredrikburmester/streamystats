import rootPackage from "../../../package.json";

/**
 * The version Jellyfin sees in our MediaBrowser Authorization header. Read from
 * the root package.json, which release-please bumps, so it can no longer drift
 * from the released version.
 */
export const STREAMYSTATS_VERSION: string = rootPackage.version;
