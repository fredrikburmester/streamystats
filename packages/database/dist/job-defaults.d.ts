/**
 * Canonical list of all scheduled jobs with their default configurations.
 * This is the single source of truth for job definitions shared between
 * job-server and nextjs-app.
 */
export declare const CRON_JOB_KEYS: readonly ["activity-sync", "recent-items-sync", "user-sync", "people-sync", "embeddings-sync", "geolocation-sync", "fingerprint-sync", "recommendation-sync", "job-cleanup", "old-job-cleanup", "full-sync", "deleted-items-cleanup"];
export declare const INTERVAL_JOB_KEYS: readonly ["session-polling"];
export declare const JOB_KEYS: readonly ["activity-sync", "recent-items-sync", "user-sync", "people-sync", "embeddings-sync", "geolocation-sync", "fingerprint-sync", "recommendation-sync", "job-cleanup", "old-job-cleanup", "full-sync", "deleted-items-cleanup", "session-polling"];
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
    defaultInterval: number;
}
export type JobDefaultConfig = CronJobDefaultConfig | IntervalJobDefaultConfig;
export declare const JOB_DEFAULTS: Record<JobKey, JobDefaultConfig>;
/**
 * Get the default cron expression for a cron job key
 */
export declare function getDefaultCron(jobKey: CronJobKey): string;
/**
 * Get the default interval for an interval job key
 */
export declare function getDefaultInterval(jobKey: IntervalJobKey): number;
/**
 * Check if a string is a valid job key
 */
export declare function isValidJobKey(key: string): key is JobKey;
/**
 * Check if a job is cron-based
 */
export declare function isCronJob(jobKey: JobKey): jobKey is CronJobKey;
/**
 * Check if a job is interval-based
 */
export declare function isIntervalJob(jobKey: JobKey): jobKey is IntervalJobKey;
export {};
//# sourceMappingURL=job-defaults.d.ts.map