/**
 * Canonical list of all scheduled jobs with their default configurations.
 * This is the single source of truth for job definitions shared between
 * job-server and nextjs-app.
 */

export const CRON_JOB_KEYS = [
  "activity-sync",
  "recent-items-sync",
  "user-sync",
  "people-sync",
  "embeddings-sync",
  "user-embeddings-sync",
  "geolocation-sync",
  "fingerprint-sync",
  "job-cleanup",
  "old-job-cleanup",
  "full-sync",
  "deleted-items-cleanup",
] as const;

export const INTERVAL_JOB_KEYS = ["session-polling"] as const;

export const JOB_KEYS = [...CRON_JOB_KEYS, ...INTERVAL_JOB_KEYS] as const;

export type CronJobKey = (typeof CRON_JOB_KEYS)[number];
export type IntervalJobKey = (typeof INTERVAL_JOB_KEYS)[number];
export type JobKey = (typeof JOB_KEYS)[number];

interface BaseJobConfig {
  key: JobKey;
  label: string;
  description: string;
  category: "sync" | "maintenance" | "ai" | "realtime";
}

export interface CronJobDefaultConfig extends BaseJobConfig {
  key: CronJobKey;
  type: "cron";
  defaultCron: string;
}

export interface IntervalJobDefaultConfig extends BaseJobConfig {
  key: IntervalJobKey;
  type: "interval";
  defaultInterval: number; // in seconds
}

export type JobDefaultConfig = CronJobDefaultConfig | IntervalJobDefaultConfig;

export const JOB_DEFAULTS: Record<JobKey, JobDefaultConfig> = {
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
  "user-embeddings-sync": {
    key: "user-embeddings-sync",
    type: "cron",
    label: "User Embeddings Sync",
    description: "Pre-computes user taste profiles for fast recommendations",
    defaultCron: "0 3 * * *",
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
export function getDefaultCron(jobKey: CronJobKey): string {
  const config = JOB_DEFAULTS[jobKey];
  if (config.type !== "cron") {
    throw new Error(`Job ${jobKey} is not a cron job`);
  }
  return config.defaultCron;
}

/**
 * Get the default interval for an interval job key
 */
export function getDefaultInterval(jobKey: IntervalJobKey): number {
  const config = JOB_DEFAULTS[jobKey];
  if (config.type !== "interval") {
    throw new Error(`Job ${jobKey} is not an interval job`);
  }
  return config.defaultInterval;
}

/**
 * Check if a string is a valid job key
 */
export function isValidJobKey(key: string): key is JobKey {
  return JOB_KEYS.includes(key as JobKey);
}

/**
 * Check if a job is cron-based
 */
export function isCronJob(jobKey: JobKey): jobKey is CronJobKey {
  return JOB_DEFAULTS[jobKey].type === "cron";
}

/**
 * Check if a job is interval-based
 */
export function isIntervalJob(jobKey: JobKey): jobKey is IntervalJobKey {
  return JOB_DEFAULTS[jobKey].type === "interval";
}
