import {
  db,
  servers,
  serverJobConfigurations,
  getDefaultCron,
  isCronJob,
  type JobKey,
  type CronJobKey,
} from "@streamystats/database";
import { eq, and, sql, ne, or, isNull, lt } from "drizzle-orm";
import { getJobQueue } from "./queue";
import { JELLYFIN_JOB_NAMES } from "../jellyfin/workers";
import { GEOLOCATION_JOB_NAMES } from "./geolocation-jobs";
import { BACKFILL_JOB_NAMES } from "./server-jobs";
import { cancelJobsByName } from "../routes/jobs/utils";
import { SCHEDULER_MAINTENANCE_JOB_NAME } from "./scheduler-maintenance";

interface ServerJobConfig {
  cronExpression: string | null;
  enabled: boolean;
}

const SEND_OPTIONS = {
  STANDARD: { expireInSeconds: 1800, retryLimit: 1, retryDelay: 60 },
  MEDIUM: { expireInSeconds: 3600, retryLimit: 1, retryDelay: 60 },
  LONG: { expireInSeconds: 7200, retryLimit: 1, retryDelay: 300 },
  EXTENDED: { expireInSeconds: 14400, retryLimit: 1, retryDelay: 300 },
} as const;

/**
 * Maps scheduler job keys to pg-boss job names and their data builders
 */
const SCHEDULER_JOB_CONFIG: Record<JobKey, {
  pgBossName: string;
  buildData: (serverId: number) => object;
  sendOptions: typeof SEND_OPTIONS[keyof typeof SEND_OPTIONS];
} | null> = {
  "activity-sync": {
    pgBossName: JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC,
    buildData: (serverId) => ({
      serverId,
      options: { activityOptions: { pageSize: 100, maxPages: 1, intelligent: true } },
    }),
    sendOptions: SEND_OPTIONS.STANDARD,
  },
  "recent-items-sync": {
    pgBossName: JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC,
    buildData: (serverId) => ({
      serverId,
      options: { itemOptions: { recentItemsLimit: 100 } },
    }),
    sendOptions: SEND_OPTIONS.STANDARD,
  },
  "user-sync": {
    pgBossName: JELLYFIN_JOB_NAMES.USERS_SYNC,
    buildData: (serverId) => ({
      serverId,
      options: { userOptions: {} },
    }),
    sendOptions: SEND_OPTIONS.STANDARD,
  },
  "people-sync": {
    pgBossName: JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
    buildData: (serverId) => ({ serverId }),
    sendOptions: SEND_OPTIONS.LONG,
  },
  "embeddings-sync": {
    pgBossName: "generate-item-embeddings",
    buildData: (serverId) => ({ serverId, batchSize: 50 }),
    sendOptions: SEND_OPTIONS.MEDIUM,
  },
  "full-sync": {
    pgBossName: JELLYFIN_JOB_NAMES.FULL_SYNC,
    buildData: (serverId) => ({ serverId, options: {} }),
    sendOptions: SEND_OPTIONS.EXTENDED,
  },
  "geolocation-sync": {
    pgBossName: GEOLOCATION_JOB_NAMES.GEOLOCATE_ACTIVITIES,
    buildData: (serverId) => ({ serverId, batchSize: 100 }),
    sendOptions: SEND_OPTIONS.STANDARD,
  },
  "fingerprint-sync": {
    pgBossName: GEOLOCATION_JOB_NAMES.CALCULATE_FINGERPRINTS,
    buildData: (serverId) => ({ serverId }),
    sendOptions: SEND_OPTIONS.MEDIUM,
  },
  "deleted-items-cleanup": null,
  "job-cleanup": null,
  "old-job-cleanup": null,
  "session-polling": null,
};

class SyncScheduler {
  private enabled: boolean = false;

  // Cache of per-server job configurations
  // Map<serverId, Map<jobKey, config>>
  private serverJobConfigs: Map<number, Map<string, ServerJobConfig>> =
    new Map();

  /**
   * Reset any servers stuck in "syncing" status on startup
   * This handles cases where the server crashed mid-sync
   */
  private async performStartupCleanup(): Promise<void> {
    try {
      console.log("[scheduler] phase=startup-cleanup status=start");

      // Reset all servers stuck in "syncing" status
      const result = await db
        .update(servers)
        .set({
          syncStatus: "pending",
          syncError: null,
          updatedAt: new Date(),
        })
        .where(eq(servers.syncStatus, "syncing"))
        .returning({ id: servers.id, name: servers.name });

      if (result.length > 0) {
        console.log(
          `[scheduler] phase=startup-cleanup status=reset resetCount=${
            result.length
          } servers=${result.map((s) => s.name).join(",")}`
        );
      } else {
        console.log("[scheduler] phase=startup-cleanup status=clean");
      }
    } catch (error) {
      console.error("[scheduler] phase=startup-cleanup status=error", error);
    }
  }

  /**
   * Start the scheduler with current configuration
   */
  async start(): Promise<void> {
    if (this.enabled) {
      console.log("[scheduler] status=already-running");
      return;
    }

    // Load per-server job configurations from database
    await this.loadAllServerConfigs();

    await this.performStartupCleanup();
    await this.triggerJellyfinIdBackfill();

    const skipStartupFullSync =
      Bun.env.SKIP_STARTUP_FULL_SYNC?.toLowerCase() === "true" ||
      Bun.env.SKIP_STARTUP_FULL_SYNC === "1";

    if (skipStartupFullSync) {
      console.log("[scheduler] trigger=startup-full-sync status=skipped reason=SKIP_STARTUP_FULL_SYNC");
    } else {
      console.log("[scheduler] trigger=startup-full-sync");
      await this.triggerFullSync();
    }

    this.enabled = true;

    try {
      // Sync pg-boss schedules for all servers
      await this.syncAllSchedules();

      console.log(
        `[scheduler] status=started mode=pg-boss-native`
      );

      // Log per-server configurations
      await this.logServerConfigs();
    } catch (error) {
      console.error("[scheduler] status=start-failed", error);
      this.enabled = false;
      throw error;
    }
  }

  /**
   * Sync pg-boss schedules for all servers based on their configurations
   */
  private async syncAllSchedules(): Promise<void> {
    const boss = await getJobQueue();
    const allServers = await db.select({ id: servers.id, name: servers.name }).from(servers);

    console.log(`[scheduler] syncing schedules for ${allServers.length} servers`);

    for (const server of allServers) {
      await this.syncSchedulesForServer(server.id, server.name);
    }

    // Also schedule global jobs (job-cleanup, old-job-cleanup)
    await this.scheduleGlobalJobs();
  }

  /**
   * Sync pg-boss schedules for a specific server
   */
  async syncSchedulesForServer(serverId: number, serverName?: string): Promise<void> {
    const boss = await getJobQueue();
    const name = serverName || `server-${serverId}`;

    for (const [jobKey, config] of Object.entries(SCHEDULER_JOB_CONFIG)) {
      if (!config) continue; // Skip non-pg-boss jobs (e.g., session-polling)

      // Only process cron-based jobs
      const typedJobKey = jobKey as JobKey;
      if (!isCronJob(typedJobKey)) continue;

      const scheduleKey = `server-${serverId}`;
      const cronExpression = this.getEffectiveCron(serverId, typedJobKey);
      const isEnabled = this.isJobEnabledForServer(serverId, typedJobKey);

      try {
        if (isEnabled) {
          // Create or update the schedule
          await boss.schedule(
            config.pgBossName,
            cronExpression,
            config.buildData(serverId),
            {
              key: scheduleKey,
              ...config.sendOptions,
            }
          );
          console.log(
            `[scheduler] scheduled job=${jobKey} server="${name}" cron="${cronExpression}"`
          );
        } else {
          // Remove the schedule if disabled
          await boss.unschedule(config.pgBossName, scheduleKey);
          console.log(
            `[scheduler] unscheduled job=${jobKey} server="${name}" reason=disabled`
          );
        }
      } catch (error) {
        console.error(
          `[scheduler] failed to sync schedule job=${jobKey} server="${name}"`,
          error
        );
      }
    }
  }

  /**
   * Schedule global jobs that aren't per-server
   */
  private async scheduleGlobalJobs(): Promise<void> {
    const boss = await getJobQueue();

    // Schedule a maintenance job that runs every minute
    // It handles: stale sync reset, stale job cleanup, deleted items (hourly), old job cleanup (daily at 3AM)
    const maintenanceCron = "* * * * *"; // Every minute
    await boss.schedule(
      SCHEDULER_MAINTENANCE_JOB_NAME,
      maintenanceCron,
      {},
      { key: "global" }
    );
    console.log(`[scheduler] scheduled global maintenance job`);
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    if (!this.enabled) {
      console.log("[scheduler] status=not-running");
      return;
    }

    // Note: pg-boss schedules persist in the database, so we don't need to stop them
    // They'll be re-synced on next startup
    this.enabled = false;
    console.log("[scheduler] status=stopped");
  }

  /**
   * Update scheduler configuration (enable/disable only)
   * Per-server cron intervals are now managed via the database and pg-boss schedules
   */
  updateConfig(config: { enabled?: boolean }): void {
    if (config.enabled !== undefined && config.enabled !== this.enabled) {
      if (config.enabled) {
        this.start();
      } else {
        this.stop();
      }
    }
  }

  /**
   * Get servers available for periodic sync
   * Returns servers that are not syncing, or have been syncing for more than 30 minutes (stale)
   */
  private async getServersForPeriodicSync() {
    return await db
      .select()
      .from(servers)
      .where(
        or(
          ne(servers.syncStatus, "syncing"),
          // Include servers stuck in "syncing" for more than 30 minutes
          and(
            eq(servers.syncStatus, "syncing"),
            or(
              isNull(servers.lastSyncStarted),
              lt(servers.lastSyncStarted, sql`NOW() - INTERVAL '30 minutes'`)
            )
          )
        )
      );
  }

  /**
   * Load all server job configurations from database into cache
   */
  private async loadAllServerConfigs(): Promise<void> {
    try {
      const configs = await db.select().from(serverJobConfigurations);

      // Clear existing cache
      this.serverJobConfigs.clear();

      // Build the cache
      for (const config of configs) {
        if (!this.serverJobConfigs.has(config.serverId)) {
          this.serverJobConfigs.set(config.serverId, new Map());
        }
        this.serverJobConfigs.get(config.serverId)?.set(config.jobKey, {
          cronExpression: config.cronExpression,
          enabled: config.enabled,
        });
      }

      console.log(
        `[scheduler] loaded ${this.serverJobConfigs.size} servers with custom job configs`
      );
    } catch (error) {
      console.error("[scheduler] failed to load server job configs:", error);
    }
  }

  /**
   * Log per-server job configurations
   */
  private async logServerConfigs(): Promise<void> {
    try {
      // Get all servers
      const allServers = await db.select({ id: servers.id, name: servers.name }).from(servers);

      for (const server of allServers) {
        const serverConfigs = this.serverJobConfigs.get(server.id);

        if (!serverConfigs || serverConfigs.size === 0) {
          console.log(`[scheduler] server="${server.name}" (id=${server.id}) using all defaults`);
          continue;
        }

        // Build a summary of custom configs
        const overrides: string[] = [];
        const disabled: string[] = [];

        for (const [jobKey, config] of serverConfigs) {
          if (!config.enabled) {
            disabled.push(jobKey);
          } else if (config.cronExpression) {
            overrides.push(`${jobKey}=${config.cronExpression}`);
          }
        }

        const parts: string[] = [];
        if (overrides.length > 0) {
          parts.push(`custom=[${overrides.join(", ")}]`);
        }
        if (disabled.length > 0) {
          parts.push(`disabled=[${disabled.join(", ")}]`);
        }

        console.log(
          `[scheduler] server="${server.name}" (id=${server.id}) ${parts.join(" ")}`
        );
      }
    } catch (error) {
      console.error("[scheduler] failed to log server configs:", error);
    }
  }

  /**
   * Reload job configurations for a specific server
   */
  async reloadServerConfig(serverId: number): Promise<void> {
    try {
      const configs = await db
        .select()
        .from(serverJobConfigurations)
        .where(eq(serverJobConfigurations.serverId, serverId));

      // Update cache for this server
      const serverConfigs = new Map<string, ServerJobConfig>();
      for (const config of configs) {
        serverConfigs.set(config.jobKey, {
          cronExpression: config.cronExpression,
          enabled: config.enabled,
        });
      }

      if (serverConfigs.size > 0) {
        this.serverJobConfigs.set(serverId, serverConfigs);
      } else {
        this.serverJobConfigs.delete(serverId);
      }

      console.log(
        `[scheduler] reloaded config for server ${serverId}, ${serverConfigs.size} custom jobs`
      );

      // Sync pg-boss schedules for this server
      await this.syncSchedulesForServer(serverId);
    } catch (error) {
      console.error(
        `[scheduler] failed to reload config for server ${serverId}:`,
        error
      );
    }
  }

  /**
   * Check if a job is enabled for a specific server
   * Returns true if no custom config exists (uses default) or if explicitly enabled
   */
  isJobEnabledForServer(serverId: number, jobKey: JobKey): boolean {
    const serverConfigs = this.serverJobConfigs.get(serverId);
    if (!serverConfigs) {
      // No custom config for this server, use default (enabled)
      return true;
    }

    const jobConfig = serverConfigs.get(jobKey);
    if (!jobConfig) {
      // No custom config for this job, use default (enabled)
      return true;
    }

    return jobConfig.enabled;
  }

  /**
   * Get the effective cron expression for a server/job
   * Returns the custom cron if set, otherwise the default
   * Only valid for cron-based jobs
   */
  private getEffectiveCron(serverId: number, jobKey: CronJobKey): string {
    const serverConfigs = this.serverJobConfigs.get(serverId);
    if (serverConfigs) {
      const jobConfig = serverConfigs.get(jobKey);
      if (jobConfig?.cronExpression) {
        return jobConfig.cronExpression;
      }
    }
    return getDefaultCron(jobKey);
  }


  /**
   * Backfill Jellyfin server IDs for existing servers missing jellyfinId
   * This is a one-time startup job that only runs if there are servers without IDs
   */
  private async triggerJellyfinIdBackfill(): Promise<void> {
    try {
      // Check if any servers are missing jellyfinId
      const serversWithoutId = await db
        .select({ id: servers.id })
        .from(servers)
        .where(isNull(servers.jellyfinId))
        .limit(1);

      if (serversWithoutId.length === 0) {
        console.log("[scheduler] trigger=jellyfin-id-backfill status=skipped reason=all-servers-have-ids");
        return;
      }

      console.log("[scheduler] trigger=jellyfin-id-backfill");
      const boss = await getJobQueue();
      await boss.send(BACKFILL_JOB_NAMES.BACKFILL_JELLYFIN_IDS, {});
    } catch (error) {
      console.error("[scheduler] trigger=jellyfin-id-backfill status=error", error);
    }
  }

  /**
   * Trigger full sync for all active servers
   */
  private async triggerFullSync(): Promise<void> {
    try {
      console.log("[scheduler] trigger=full-sync");

      // Get all servers that are not currently syncing (or stale syncing)
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        console.log("[scheduler] skipped=full-sync reason=servers-busy");
        return;
      }

      const boss = await getJobQueue();
      let queuedCount = 0;

      // Queue full sync jobs for each server
      for (const server of activeServers) {
        // Check if job should run for this server (enabled + cron matches)
        if (!this.isJobEnabledForServer(server.id, "full-sync")) {
          continue;
        }

        try {
          await boss.send(
            JELLYFIN_JOB_NAMES.FULL_SYNC,
            {
              serverId: server.id,
              options: {
                // Full sync options - will sync users, libraries, items, and activities
                userOptions: {},
                libraryOptions: {},
                itemOptions: {
                  // Use job-server defaults (and env overrides) to avoid hammering Jellyfin
                },
                activityOptions: {
                  pageSize: 1000,
                  maxPages: 5000,
                  concurrency: 2,
                  apiRequestDelayMs: 300,
                },
              },
            },
            {
              expireInSeconds: 21600, // Job expires after 6 hours (21600 seconds)
              retryLimit: 1, // Retry once if it fails
              retryDelay: 300, // Wait 5 minutes before retrying
            }
          );

          queuedCount++;
          console.log(
            `[scheduler] queued=full-sync server=${server.name} serverId=${server.id}`
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=full-sync server=${server.name} status=error`,
            error
          );
        }
      }

      console.log(
        `[scheduler] completed=full-sync serverCount=${queuedCount}`
      );
    } catch (error) {
      console.error("[scheduler] trigger=full-sync status=error", error);
    }
  }

  /**
   * Manually trigger activity sync for a specific server
   */
  async triggerServerActivitySync(
    serverId: number,
    limit: number = 100
  ): Promise<void> {
    try {
      const boss = await getJobQueue();

      await boss.send(
        JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC,
        {
          serverId,
          options: {
            activityOptions: {
              limit,
            },
          },
        },
        {
          expireInSeconds: 1800, // Job expires after 30 minutes (1800 seconds)
          retryLimit: 1, // Retry once if it fails
          retryDelay: 60, // Wait 60 seconds before retrying
        }
      );

      console.log(
        `[scheduler] queued=manual-activity-sync serverId=${serverId} limit=${limit}`
      );
    } catch (error) {
      console.error(
        `[scheduler] queued=manual-activity-sync serverId=${serverId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger recently added items sync for a specific server
   */
  async triggerServerRecentItemsSync(
    serverId: number,
    limit: number = 100
  ): Promise<void> {
    try {
      const boss = await getJobQueue();

      await boss.send(
        JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC,
        {
          serverId,
          options: {
            itemOptions: {
              recentItemsLimit: limit,
            },
          },
        },
        {
          expireInSeconds: 1800, // Job expires after 30 minutes (1800 seconds)
          retryLimit: 1, // Retry once if it fails
          retryDelay: 60, // Wait 60 seconds before retrying
        }
      );

      console.log(
        `[scheduler] queued=manual-recent-items-sync serverId=${serverId} limit=${limit}`
      );
    } catch (error) {
      console.error(
        `[scheduler] queued=manual-recent-items-sync serverId=${serverId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger full sync for a specific server.
   * Cancels any existing full sync jobs for this server before starting.
   */
  async triggerServerFullSync(serverId: number): Promise<void> {
    try {
      const cancelledCount = await cancelJobsByName(
        JELLYFIN_JOB_NAMES.FULL_SYNC,
        serverId
      );
      if (cancelledCount > 0) {
        console.log(
          `[scheduler] cancelled=full-sync serverId=${serverId} cancelledCount=${cancelledCount}`
        );
      }

      const boss = await getJobQueue();

      await boss.send(
        JELLYFIN_JOB_NAMES.FULL_SYNC,
        {
          serverId,
          options: {
            // Full sync options - will sync users, libraries, items, and activities
            userOptions: {},
            libraryOptions: {},
            itemOptions: {
              // Use job-server defaults (and env overrides) to avoid hammering Jellyfin
            },
            activityOptions: {
              pageSize: 1000,
              maxPages: 1000,
              concurrency: 2,
              apiRequestDelayMs: 300,
            },
          },
        },
        {
          expireInSeconds: 21600, // Job expires after 6 hours (21600 seconds)
          retryLimit: 1, // Retry once if it fails
          retryDelay: 300, // Wait 5 minutes before retrying
        }
      );

      console.log(`[scheduler] queued=manual-full-sync serverId=${serverId}`);
    } catch (error) {
      console.error(
        `[scheduler] queued=manual-full-sync serverId=${serverId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger user sync for a specific server
   */
  async triggerServerUserSync(serverId: number): Promise<void> {
    try {
      const boss = await getJobQueue();

      await boss.send(
        JELLYFIN_JOB_NAMES.USERS_SYNC,
        {
          serverId,
          options: {
            userOptions: {
              // User sync specific options can be added here
            },
          },
        },
        {
          expireInSeconds: 1800, // Job expires after 30 minutes (1800 seconds)
          retryLimit: 1, // Retry once if it fails
          retryDelay: 60, // Wait 60 seconds before retrying
        }
      );

      console.log(`[scheduler] queued=manual-user-sync serverId=${serverId}`);
    } catch (error) {
      console.error(
        `[scheduler] queued=manual-user-sync serverId=${serverId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger items sync for a specific library
   */
  async triggerLibraryItemsSync(
    serverId: number,
    libraryId: string
  ): Promise<void> {
    try {
      const boss = await getJobQueue();

      await boss.send(
        JELLYFIN_JOB_NAMES.ITEMS_SYNC,
        {
          serverId,
          syncType: "items",
          options: {
            itemOptions: {
              libraryId,
            },
          },
        },
        {
          expireInSeconds: 7200, // Job expires after 2 hours (7200 seconds)
          retryLimit: 1, // Retry once if it fails
          retryDelay: 60, // Wait 60 seconds before retrying
        }
      );

      console.log(
        `[scheduler] queued=manual-library-items-sync serverId=${serverId} libraryId=${libraryId}`
      );
    } catch (error) {
      console.error(
        `[scheduler] queued=manual-library-items-sync serverId=${serverId} libraryId=${libraryId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger people sync for a specific server.
   * Syncs actors, directors, and other people data from Jellyfin.
   */
  async triggerServerPeopleSync(serverId: number): Promise<void> {
    try {
      const boss = await getJobQueue();

      await boss.send(
        JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
        { serverId },
        {
          singletonKey: `jellyfin-people-sync-${serverId}`,
          expireInSeconds: 3600,
          retryLimit: 1,
          retryDelay: 60,
        }
      );

      console.log(`[scheduler] queued=manual-people-sync serverId=${serverId}`);
    } catch (error) {
      console.error(
        `[scheduler] queued=manual-people-sync serverId=${serverId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger geolocation backfill for a specific server.
   * Processes all existing activities that don't have location data.
   */
  async triggerServerGeolocationBackfill(serverId: number): Promise<void> {
    try {
      const boss = await getJobQueue();

      await boss.send(
        GEOLOCATION_JOB_NAMES.BACKFILL_LOCATIONS,
        { serverId, batchSize: 500 },
        {
          expireInSeconds: 21600,
          retryLimit: 1,
          retryDelay: 300,
        }
      );

      console.log(
        `[scheduler] queued=geolocation-backfill serverId=${serverId}`
      );
    } catch (error) {
      console.error(
        `[scheduler] queued=geolocation-backfill serverId=${serverId} status=error`,
        error
      );
      throw error;
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      mode: "pg-boss-native",
      defaultIntervals: {
        activitySync: getDefaultCron("activity-sync"),
        recentItemsSync: getDefaultCron("recent-items-sync"),
        userSync: getDefaultCron("user-sync"),
        peopleSync: getDefaultCron("people-sync"),
        embeddingsSync: getDefaultCron("embeddings-sync"),
        geolocationSync: getDefaultCron("geolocation-sync"),
        fingerprintSync: getDefaultCron("fingerprint-sync"),
        jobCleanup: getDefaultCron("job-cleanup"),
        oldJobCleanup: getDefaultCron("old-job-cleanup"),
        fullSync: getDefaultCron("full-sync"),
        deletedItemsCleanup: getDefaultCron("deleted-items-cleanup"),
      },
      serversWithCustomConfigs: this.serverJobConfigs.size,
      healthCheck: this.enabled,
    };
  }
}

// Export singleton instance
export const activityScheduler = new SyncScheduler();
