"use strict";
/**
 * Canonical list of all scheduled jobs with their default configurations.
 * This is the single source of truth for job definitions shared between
 * job-server and nextjs-app.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_DEFAULTS = exports.JOB_KEYS = exports.INTERVAL_JOB_KEYS = exports.CRON_JOB_KEYS = void 0;
exports.getDefaultCron = getDefaultCron;
exports.getDefaultInterval = getDefaultInterval;
exports.isValidJobKey = isValidJobKey;
exports.isCronJob = isCronJob;
exports.isIntervalJob = isIntervalJob;
exports.CRON_JOB_KEYS = [
    "activity-sync",
    "recent-items-sync",
    "user-sync",
    "people-sync",
    "embeddings-sync",
    "geolocation-sync",
    "fingerprint-sync",
    "recommendation-sync",
    "job-cleanup",
    "old-job-cleanup",
    "full-sync",
    "deleted-items-cleanup",
];
exports.INTERVAL_JOB_KEYS = ["session-polling"];
exports.JOB_KEYS = [...exports.CRON_JOB_KEYS, ...exports.INTERVAL_JOB_KEYS];
exports.JOB_DEFAULTS = {
    "activity-sync": {
        key: "activity-sync",
        type: "cron",
        label: "Activity Sync",
        description: "Syncs recent user activities from Jellyfin",
        defaultCron: "*/5 * * * *",
        category: "sync",
    },
    "recent-items-sync": {
        key: "recent-items-sync",
        type: "cron",
        label: "Recent Items Sync",
        description: "Syncs recently added media items from Jellyfin",
        defaultCron: "*/5 * * * *",
        category: "sync",
    },
    "user-sync": {
        key: "user-sync",
        type: "cron",
        label: "User Sync",
        description: "Syncs user accounts from Jellyfin",
        defaultCron: "*/5 * * * *",
        category: "sync",
    },
    "people-sync": {
        key: "people-sync",
        type: "cron",
        label: "People Sync",
        description: "Syncs actors, directors, and other people metadata",
        defaultCron: "*/15 * * * *",
        category: "sync",
    },
    "embeddings-sync": {
        key: "embeddings-sync",
        type: "cron",
        label: "Embeddings Sync",
        description: "Generates AI embeddings for media items",
        defaultCron: "*/15 * * * *",
        category: "ai",
    },
    "geolocation-sync": {
        key: "geolocation-sync",
        type: "cron",
        label: "Geolocation Sync",
        description: "Resolves IP addresses to geographic locations",
        defaultCron: "*/15 * * * *",
        category: "sync",
    },
    "fingerprint-sync": {
        key: "fingerprint-sync",
        type: "cron",
        label: "Fingerprint Sync",
        description: "Calculates user behavioral fingerprints for security",
        defaultCron: "0 4 * * *",
        category: "sync",
    },
    "recommendation-sync": {
        key: "recommendation-sync",
        type: "cron",
        label: "Recommendation Sync",
        description: "Builds the recommendation graph (co-watch, people, and semantic edges) and enriched user taste profiles",
        defaultCron: "30 4 * * *",
        category: "ai",
    },
    "job-cleanup": {
        key: "job-cleanup",
        type: "cron",
        label: "Job Cleanup",
        description: "Cleans up stale and stuck jobs",
        defaultCron: "*/1 * * * *",
        category: "maintenance",
    },
    "old-job-cleanup": {
        key: "old-job-cleanup",
        type: "cron",
        label: "Old Job Cleanup",
        description: "Removes job results older than 10 days",
        defaultCron: "0 3 * * *",
        category: "maintenance",
    },
    "full-sync": {
        key: "full-sync",
        type: "cron",
        label: "Full Sync",
        description: "Complete sync of all data from Jellyfin",
        defaultCron: "0 2 * * *",
        category: "sync",
    },
    "deleted-items-cleanup": {
        key: "deleted-items-cleanup",
        type: "cron",
        label: "Deleted Items Cleanup",
        description: "Removes items that were deleted from Jellyfin",
        defaultCron: "0 * * * *",
        category: "maintenance",
    },
    "session-polling": {
        key: "session-polling",
        type: "interval",
        label: "Session Polling",
        description: "Polls Jellyfin for active playback sessions",
        defaultInterval: 5, // 5 seconds
        category: "realtime",
    },
};
/**
 * Get the default cron expression for a cron job key
 */
function getDefaultCron(jobKey) {
    const config = exports.JOB_DEFAULTS[jobKey];
    if (config.type !== "cron") {
        throw new Error(`Job ${jobKey} is not a cron job`);
    }
    return config.defaultCron;
}
/**
 * Get the default interval for an interval job key
 */
function getDefaultInterval(jobKey) {
    const config = exports.JOB_DEFAULTS[jobKey];
    if (config.type !== "interval") {
        throw new Error(`Job ${jobKey} is not an interval job`);
    }
    return config.defaultInterval;
}
/**
 * Check if a string is a valid job key
 */
function isValidJobKey(key) {
    return exports.JOB_KEYS.includes(key);
}
/**
 * Check if a job is cron-based
 */
function isCronJob(jobKey) {
    return exports.JOB_DEFAULTS[jobKey].type === "cron";
}
/**
 * Check if a job is interval-based
 */
function isIntervalJob(jobKey) {
    return exports.JOB_DEFAULTS[jobKey].type === "interval";
}
//# sourceMappingURL=job-defaults.js.map