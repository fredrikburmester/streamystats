import * as cron from "node-cron";
import { db, servers, jobResults, items } from "@streamystats/database";
import type { EmbeddingJobResult } from "@streamystats/database/schema";
import { eq, and, sql, ne, or, isNull, lt } from "drizzle-orm";
import { getJobQueue } from "./queue";
import { JELLYFIN_JOB_NAMES } from "../jellyfin/workers";
import { GEOLOCATION_JOB_NAMES } from "./geolocation-jobs";
import { cleanupDeletedItems } from "../jellyfin/sync/deleted-items";
import { cancelJobsByName } from "../routes/jobs/utils";

class SyncScheduler {
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private enabled: boolean = false;
  private activitySyncInterval: string =
    Bun.env.CRON_ACTIVITY_SYNC || "*/1 * * * *"; // Every minute
  private recentItemsSyncInterval: string =
    Bun.env.CRON_RECENT_ITEMS_SYNC || "*/1 * * * *"; // Every minute
  private userSyncInterval: string = Bun.env.CRON_USER_SYNC || "*/1 * * * *"; // Every minute
  private peopleSyncInterval: string =
    Bun.env.CRON_PEOPLE_SYNC || "*/15 * * * *"; // Every 15 minutes
  private embeddingsSyncInterval: string =
    Bun.env.CRON_EMBEDDINGS_SYNC || "*/15 * * * *"; // Every 15 minutes
  private geolocationSyncInterval: string =
    Bun.env.CRON_GEOLOCATION_SYNC || "*/5 * * * *"; // Every 5 minutes
  private fingerprintSyncInterval: string =
    Bun.env.CRON_FINGERPRINT_SYNC || "0 4 * * *"; // Daily at 4 AM
  private jobCleanupInterval: string =
    Bun.env.CRON_JOB_CLEANUP || "*/1 * * * *"; // Every minute
  private oldJobCleanupInterval: string =
    Bun.env.CRON_OLD_JOB_CLEANUP || "0 3 * * *"; // Daily at 3 AM
  private fullSyncInterval: string = Bun.env.CRON_FULL_SYNC || "0 2 * * *"; // Daily at 2 AM
  private deletedItemsCleanupInterval: string =
    Bun.env.CRON_DELETED_ITEMS_CLEANUP || "0 * * * *"; // Every hour

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

    await this.performStartupCleanup();
    
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
      // Activity sync task
      const activityTask = cron.schedule(this.activitySyncInterval, () => {
        this.triggerActivitySync().catch((error) => {
          console.error("Error during scheduled activity sync:", error);
        });
      });

      // Recent items sync task
      const recentItemsTask = cron.schedule(
        this.recentItemsSyncInterval,
        () => {
          this.triggerRecentItemsSync().catch((error) => {
            console.error("Error during scheduled recent items sync:", error);
          });
        }
      );

      // User sync task
      const userSyncTask = cron.schedule(this.userSyncInterval, () => {
        this.triggerUserSync().catch((error) => {
          console.error("Error during scheduled user sync:", error);
        });
      });

      // People sync task (background backfill)
      const peopleSyncTask = cron.schedule(this.peopleSyncInterval, () => {
        this.triggerPeopleSync().catch((error) => {
          console.error("Error during scheduled people sync:", error);
        });
      });

      // Embeddings sync task (background backfill)
      const embeddingsSyncTask = cron.schedule(
        this.embeddingsSyncInterval,
        () => {
          this.triggerEmbeddingsSync().catch((error) => {
            console.error("Error during scheduled embeddings sync:", error);
          });
        }
      );

      // Job cleanup task for stale embedding jobs
      const jobCleanupTask = cron.schedule(this.jobCleanupInterval, () => {
        this.triggerJobCleanup().catch((error) => {
          console.error("Error during scheduled job cleanup:", error);
        });
      });

      // Old job cleanup task - removes job results older than 10 days
      const oldJobCleanupTask = cron.schedule(
        this.oldJobCleanupInterval,
        () => {
          this.triggerOldJobCleanup().catch((error) => {
            console.error("Error during scheduled old job cleanup:", error);
          });
        }
      );

      // Full sync task - daily complete sync
      const fullSyncTask = cron.schedule(this.fullSyncInterval, () => {
        this.triggerFullSync().catch((error) => {
          console.error("Error during scheduled full sync:", error);
        });
      });

      // Deleted items cleanup task - hourly
      const deletedItemsCleanupTask = cron.schedule(
        this.deletedItemsCleanupInterval,
        () => {
          this.triggerDeletedItemsCleanup().catch((error) => {
            console.error(
              "Error during scheduled deleted items cleanup:",
              error
            );
          });
        }
      );

      // Geolocation sync task - geolocate new sessions
      const geolocationSyncTask = cron.schedule(
        this.geolocationSyncInterval,
        () => {
          this.triggerGeolocationSync().catch((error) => {
            console.error("Error during scheduled geolocation sync:", error);
          });
        }
      );

      // Fingerprint sync task - recalculate user fingerprints
      const fingerprintSyncTask = cron.schedule(
        this.fingerprintSyncInterval,
        () => {
          this.triggerFingerprintSync().catch((error) => {
            console.error("Error during scheduled fingerprint sync:", error);
          });
        }
      );

      this.scheduledTasks.set("activity-sync", activityTask);
      this.scheduledTasks.set("recent-items-sync", recentItemsTask);
      this.scheduledTasks.set("user-sync", userSyncTask);
      this.scheduledTasks.set("people-sync", peopleSyncTask);
      this.scheduledTasks.set("embeddings-sync", embeddingsSyncTask);
      this.scheduledTasks.set("job-cleanup", jobCleanupTask);
      this.scheduledTasks.set("old-job-cleanup", oldJobCleanupTask);
      this.scheduledTasks.set("full-sync", fullSyncTask);
      this.scheduledTasks.set("deleted-items-cleanup", deletedItemsCleanupTask);
      this.scheduledTasks.set("geolocation-sync", geolocationSyncTask);
      this.scheduledTasks.set("fingerprint-sync", fingerprintSyncTask);

      // Start all tasks
      activityTask.start();
      recentItemsTask.start();
      userSyncTask.start();
      peopleSyncTask.start();
      embeddingsSyncTask.start();
      jobCleanupTask.start();
      oldJobCleanupTask.start();
      fullSyncTask.start();
      deletedItemsCleanupTask.start();
      geolocationSyncTask.start();
      fingerprintSyncTask.start();

      console.log(
        `[scheduler] status=started activity=${this.activitySyncInterval} recentItems=${this.recentItemsSyncInterval} users=${this.userSyncInterval} people=${this.peopleSyncInterval} embeddings=${this.embeddingsSyncInterval} geolocation=${this.geolocationSyncInterval} fingerprint=${this.fingerprintSyncInterval} jobCleanup=${this.jobCleanupInterval} oldJobCleanup=${this.oldJobCleanupInterval} fullSync=${this.fullSyncInterval} deletedItems=${this.deletedItemsCleanupInterval}`
      );
    } catch (error) {
      console.error("[scheduler] status=start-failed", error);
      this.enabled = false;
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (!this.enabled) {
      console.log("[scheduler] status=not-running");
      return;
    }

    // Stop and clear all scheduled tasks
    for (const [name, task] of this.scheduledTasks) {
      try {
        task.stop();
        task.destroy();
        console.log(`[scheduler] task=${name} status=stopped`);
      } catch (error) {
        console.error(`[scheduler] task=${name} status=stop-error`, error);
      }
    }

    this.scheduledTasks.clear();
    this.enabled = false;
    console.log("[scheduler] status=stopped");
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(config: {
    enabled?: boolean;
    activitySyncInterval?: string;
    recentItemsSyncInterval?: string;
    userSyncInterval?: string;
    peopleSyncInterval?: string;
    embeddingsSyncInterval?: string;
    jobCleanupInterval?: string;
    oldJobCleanupInterval?: string;
    fullSyncInterval?: string;
    deletedItemsCleanupInterval?: string;
  }): void {
    const wasEnabled = this.enabled;

    if (config.activitySyncInterval) {
      this.activitySyncInterval = config.activitySyncInterval;
    }

    if (config.recentItemsSyncInterval) {
      this.recentItemsSyncInterval = config.recentItemsSyncInterval;
    }

    if (config.userSyncInterval) {
      this.userSyncInterval = config.userSyncInterval;
    }

    if (config.peopleSyncInterval) {
      this.peopleSyncInterval = config.peopleSyncInterval;
    }

    if (config.embeddingsSyncInterval) {
      this.embeddingsSyncInterval = config.embeddingsSyncInterval;
    }

    if (config.jobCleanupInterval) {
      this.jobCleanupInterval = config.jobCleanupInterval;
    }

    if (config.oldJobCleanupInterval) {
      this.oldJobCleanupInterval = config.oldJobCleanupInterval;
    }

    if (config.fullSyncInterval) {
      this.fullSyncInterval = config.fullSyncInterval;
    }

    if (config.deletedItemsCleanupInterval) {
      this.deletedItemsCleanupInterval = config.deletedItemsCleanupInterval;
    }

    if (config.enabled !== undefined && config.enabled !== this.enabled) {
      if (config.enabled) {
        this.start();
      } else {
        this.stop();
      }
    } else if (wasEnabled && this.enabled) {
      // Restart with new configuration if it was running
      this.stop();
      this.start();
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
   * Trigger activity sync for all active servers
   */
  private async triggerActivitySync(): Promise<void> {
    try {
      console.log("[scheduler] trigger=activity-sync");

      // Get all servers that are not currently syncing (or stale syncing)
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        console.log("[scheduler] skipped=activity-sync reason=servers-busy");
        return;
      }

      const boss = await getJobQueue();

      // Queue activity sync jobs for each server
      for (const server of activeServers) {
        try {
          await boss.send(
            JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC,
            {
              serverId: server.id,
              options: {
                activityOptions: {
                  pageSize: 100,
                  maxPages: 1,
                  intelligent: true,
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
            `[scheduler] queued=activity-sync server=${server.name} serverId=${server.id}`
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=activity-sync server=${server.name} status=error`,
            error
          );
        }
      }

      console.log(
        `[scheduler] completed=activity-sync serverCount=${activeServers.length}`
      );
    } catch (error) {
      console.error("[scheduler] trigger=activity-sync status=error", error);
    }
  }

  /**
   * Trigger recently added items sync for all active servers
   */
  private async triggerRecentItemsSync(): Promise<void> {
    try {
      console.log("[scheduler] trigger=recent-items-sync");

      // Get all servers that are not currently syncing (or stale syncing)
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        console.log(
          "[scheduler] skipped=recent-items-sync reason=servers-busy"
        );
        return;
      }

      const boss = await getJobQueue();

      // Queue recently added items sync jobs for each server
      for (const server of activeServers) {
        try {
          await boss.send(
            JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC,
            {
              serverId: server.id,
              options: {
                itemOptions: {
                  recentItemsLimit: 100, // Default limit
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
            `[scheduler] queued=recent-items-sync server=${server.name} serverId=${server.id}`
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=recent-items-sync server=${server.name} status=error`,
            error
          );
        }
      }

      console.log(
        `[scheduler] completed=recent-items-sync serverCount=${activeServers.length}`
      );
    } catch (error) {
      console.error(
        "[scheduler] trigger=recent-items-sync status=error",
        error
      );
    }
  }

  /**
   * Trigger user sync for all active servers
   */
  private async triggerUserSync(): Promise<void> {
    try {
      console.log("[scheduler] trigger=user-sync");

      // Get all servers that are not currently syncing (or stale syncing)
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        console.log("[scheduler] skipped=user-sync reason=servers-busy");
        return;
      }

      const boss = await getJobQueue();

      // Queue user sync jobs for each server
      for (const server of activeServers) {
        try {
          await boss.send(
            JELLYFIN_JOB_NAMES.USERS_SYNC,
            {
              serverId: server.id,
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

          console.log(
            `[scheduler] queued=user-sync server=${server.name} serverId=${server.id}`
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=user-sync server=${server.name} status=error`,
            error
          );
        }
      }

      console.log(
        `[scheduler] completed=user-sync serverCount=${activeServers.length}`
      );
    } catch (error) {
      console.error("[scheduler] trigger=user-sync status=error", error);
    }
  }

  /**
   * Trigger people sync for all active servers (background backfill).
   * Uses a per-server singletonKey so it can be scheduled frequently without enqueuing duplicates.
   */
  private async triggerPeopleSync(): Promise<void> {
    try {
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        return;
      }

      const boss = await getJobQueue();

      for (const server of activeServers) {
        try {
          await boss.send(
            JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
            { serverId: server.id },
            {
              singletonKey: `jellyfin-people-sync-${server.id}`,
              expireInSeconds: 3600,
              retryLimit: 1,
              retryDelay: 60,
            }
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=people-sync server=${server.name} status=error`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[scheduler] trigger=people-sync status=error", error);
    }
  }

  /**
   * Trigger embeddings generation for all eligible servers.
   * Only runs for servers with autoGenerateEmbeddings enabled and valid embedding config.
   * Skips if there is already a queued/active embeddings job for that server.
   */
  private async triggerEmbeddingsSync(): Promise<void> {
    try {
      const activeServers = await this.getServersForPeriodicSync();

      const eligibleServers = activeServers.filter(
        (server) => server.autoGenerateEmbeddings
      );

      if (eligibleServers.length === 0) {
        return;
      }

      const boss = await getJobQueue();

      for (const server of eligibleServers) {
        try {
          if (!server.embeddingProvider) {
            continue;
          }

          if (!server.embeddingBaseUrl || !server.embeddingModel) {
            continue;
          }

          const remainingCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(items)
            .where(
              and(
                eq(items.serverId, server.id),
                eq(items.processed, false),
                sql`${items.type} IN ('Movie', 'Series')`
              )
            );

          const remaining = Number(remainingCount[0]?.count ?? 0);
          if (remaining <= 0) {
            continue;
          }

          // pg-boss v12: use API to check for active jobs
          let hasActiveJob = false;
          try {
            const stats = await boss.getQueueStats("generate-item-embeddings");
            hasActiveJob = stats.activeCount > 0 || stats.queuedCount > 0;
          } catch {
            // If queue doesn't exist yet, no active jobs
            hasActiveJob = false;
          }

          if (hasActiveJob) {
            continue;
          }

          await boss.send(
            "generate-item-embeddings",
            {
              serverId: server.id,
              provider: server.embeddingProvider,
              config: {
                baseUrl: server.embeddingBaseUrl,
                apiKey: server.embeddingApiKey ?? undefined,
                model: server.embeddingModel,
                dimensions: server.embeddingDimensions || 1536,
              },
            },
            {
              expireInSeconds: 3600,
              retryLimit: 1,
              retryDelay: 60,
            }
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=embeddings-sync server=${server.name} status=error`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[scheduler] trigger=embeddings-sync status=error", error);
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

      // Queue full sync jobs for each server
      for (const server of activeServers) {
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
        `[scheduler] completed=full-sync serverCount=${activeServers.length}`
      );
    } catch (error) {
      console.error("[scheduler] trigger=full-sync status=error", error);
    }
  }

  /**
   * Reset servers stuck in "syncing" status for more than 30 minutes
   */
  private async resetStaleSyncStatus(): Promise<void> {
    try {
      const result = await db
        .update(servers)
        .set({
          syncStatus: "failed",
          syncError:
            "Sync timed out - status was stuck in syncing for more than 30 minutes",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(servers.syncStatus, "syncing"),
            or(
              isNull(servers.lastSyncStarted),
              lt(servers.lastSyncStarted, sql`NOW() - INTERVAL '30 minutes'`)
            )
          )
        )
        .returning({ id: servers.id, name: servers.name });

      if (result.length > 0) {
        console.log(
          `[scheduler] phase=reset-stale resetCount=${
            result.length
          } servers=${result.map((s) => s.name).join(",")}`
        );
      }
    } catch (error) {
      console.error("[scheduler] phase=reset-stale status=error", error);
    }
  }

  /**
   * Trigger cleanup of stale embedding jobs
   */
  private async triggerJobCleanup(): Promise<void> {
    try {
      // First, reset any servers stuck in "syncing" status
      await this.resetStaleSyncStatus();

      // Find all processing embedding jobs older than 10 minutes
      const staleJobs = await db
        .select()
        .from(jobResults)
        .where(
          and(
            eq(jobResults.jobName, "generate-item-embeddings"),
            eq(jobResults.status, "processing"),
            sql`${jobResults.createdAt} < NOW() - INTERVAL '10 minutes'`
          )
        );

      let cleanedCount = 0;

      for (const staleJob of staleJobs) {
        try {
          const result = staleJob.result as EmbeddingJobResult | null;
          const serverId = result?.serverId;

          if (serverId) {
            // Check if there's been recent heartbeat activity
            const lastHeartbeat = result?.lastHeartbeat
              ? new Date(result.lastHeartbeat).getTime()
              : new Date(staleJob.createdAt).getTime();
            const heartbeatAge = Date.now() - lastHeartbeat;

            // Only cleanup if no recent heartbeat (older than 2 minutes)
            if (heartbeatAge > 2 * 60 * 1000) {
              const processingTime = Math.min(
                Date.now() - new Date(staleJob.createdAt).getTime(),
                3600000
              );

              await db
                .update(jobResults)
                .set({
                  status: "failed",
                  error:
                    "Job exceeded maximum processing time without heartbeat",
                  processingTime,
                  result: {
                    ...result,
                    error: "Job cleanup - exceeded maximum processing time",
                    cleanedAt: new Date().toISOString(),
                    staleDuration: heartbeatAge,
                  },
                })
                .where(eq(jobResults.id, staleJob.id));

              cleanedCount++;
              console.log(
                `[cleanup] type=stale-embedding serverId=${serverId}`
              );
            }
          }
        } catch (error) {
          console.error("Error cleaning up stale job:", staleJob.jobId, error);
        }
      }

      if (cleanedCount > 0) {
        console.log(
          `[cleanup] type=stale-embedding cleanedCount=${cleanedCount}`
        );
      }
    } catch (error) {
      console.error("[scheduler] trigger=job-cleanup status=error", error);
    }
  }

  /**
   * Trigger cleanup of old job results (older than 10 days)
   */
  private async triggerOldJobCleanup(): Promise<void> {
    try {
      console.log("[scheduler] trigger=old-job-cleanup");

      const result = await db
        .delete(jobResults)
        .where(sql`${jobResults.createdAt} < NOW() - INTERVAL '10 days'`)
        .returning({ id: jobResults.id });

      const deletedCount = result.length;

      console.log(
        `[scheduler] completed=old-job-cleanup deletedCount=${deletedCount}`
      );
    } catch (error) {
      console.error("[scheduler] trigger=old-job-cleanup status=error", error);
    }
  }

  /**
   * Trigger deleted items cleanup for all servers.
   * Detects items removed from Jellyfin and soft-deletes them in the database.
   * Migrates watch history if items were re-added with new IDs.
   */
  private async triggerDeletedItemsCleanup(): Promise<void> {
    try {
      console.log("[scheduler] trigger=deleted-items-cleanup");

      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        console.log(
          "[scheduler] skipped=deleted-items-cleanup reason=servers-busy"
        );
        return;
      }

      for (const server of activeServers) {
        try {
          const result = await cleanupDeletedItems(server);

          console.log(
            `[scheduler] completed=deleted-items-cleanup server=${server.name} status=${result.status} deleted=${result.metrics.itemsSoftDeleted} migrated=${result.metrics.itemsMigrated} durationMs=${result.metrics.duration}`
          );
        } catch (error) {
          console.error(
            `[scheduler] completed=deleted-items-cleanup server=${server.name} status=error`,
            error
          );
        }
      }

      console.log(
        `[scheduler] completed=deleted-items-cleanup serverCount=${activeServers.length}`
      );
    } catch (error) {
      console.error(
        "[scheduler] trigger=deleted-items-cleanup status=error",
        error
      );
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
   * Trigger geolocation sync for all active servers.
   * Geolocates activities that don't have location data yet.
   */
  private async triggerGeolocationSync(): Promise<void> {
    try {
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        return;
      }

      const boss = await getJobQueue();

      for (const server of activeServers) {
        try {
          await boss.send(
            GEOLOCATION_JOB_NAMES.GEOLOCATE_ACTIVITIES,
            { serverId: server.id, batchSize: 100 },
            {
              singletonKey: `geolocate-activities-${server.id}`,
              expireInSeconds: 1800,
              retryLimit: 1,
              retryDelay: 60,
            }
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=geolocation-sync server=${server.name} status=error`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[scheduler] trigger=geolocation-sync status=error", error);
    }
  }

  /**
   * Trigger fingerprint calculation for all active servers.
   * Recalculates user behavioral fingerprints based on session data.
   */
  private async triggerFingerprintSync(): Promise<void> {
    try {
      const activeServers = await this.getServersForPeriodicSync();

      if (activeServers.length === 0) {
        return;
      }

      const boss = await getJobQueue();

      for (const server of activeServers) {
        try {
          await boss.send(
            GEOLOCATION_JOB_NAMES.CALCULATE_FINGERPRINTS,
            { serverId: server.id },
            {
              singletonKey: `calculate-fingerprints-${server.id}`,
              expireInSeconds: 3600,
              retryLimit: 1,
              retryDelay: 120,
            }
          );
        } catch (error) {
          console.error(
            `[scheduler] queued=fingerprint-sync server=${server.name} status=error`,
            error
          );
        }
      }
    } catch (error) {
      console.error("[scheduler] trigger=fingerprint-sync status=error", error);
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
      activitySyncInterval: this.activitySyncInterval,
      recentItemsSyncInterval: this.recentItemsSyncInterval,
      userSyncInterval: this.userSyncInterval,
      peopleSyncInterval: this.peopleSyncInterval,
      embeddingsSyncInterval: this.embeddingsSyncInterval,
      geolocationSyncInterval: this.geolocationSyncInterval,
      fingerprintSyncInterval: this.fingerprintSyncInterval,
      jobCleanupInterval: this.jobCleanupInterval,
      oldJobCleanupInterval: this.oldJobCleanupInterval,
      fullSyncInterval: this.fullSyncInterval,
      deletedItemsCleanupInterval: this.deletedItemsCleanupInterval,
      runningTasks: Array.from(this.scheduledTasks.keys()),
      healthCheck: this.enabled,
    };
  }
}

// Export singleton instance
export const activityScheduler = new SyncScheduler();
