import { eq, desc } from "drizzle-orm";
import {
  db,
  activities,
  Server,
  NewActivity,
  users,
} from "@streamystats/database";
import { JellyfinClient, JellyfinActivity } from "../client";
import {
  SyncMetricsTracker,
  SyncResult,
  createSyncResult,
} from "../sync-metrics";
import pMap from "p-map";
import { sleep } from "../../utils/sleep";
import { formatSyncLogLine } from "./sync-log";
import { formatError } from "../../utils/format-error";

export interface ActivitySyncOptions {
  pageSize?: number;
  maxPages?: number;
  concurrency?: number;
  apiRequestDelayMs?: number;
  intelligent?: boolean; // Enable intelligent sync mode
}

export interface ActivitySyncData {
  activitiesProcessed: number;
  activitiesInserted: number;
  activitiesUpdated: number;
  pagesFetched: number;
}

const ACTIVITYLOG_SYSTEM_USERID = "00000000000000000000000000000000";

export async function syncActivities(
  server: Server,
  options: ActivitySyncOptions = {}
): Promise<SyncResult<ActivitySyncData>> {
  const {
    pageSize = 1000,
    maxPages = 5000, // Prevent infinite loops
    concurrency = 2,
    apiRequestDelayMs = 300,
  } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    console.info(
      `[activities-sync] server=${server.name} phase=start pageSize=${pageSize} concurrency=${concurrency} apiRequestDelayMs=${apiRequestDelayMs}`
    );

    let startIndex = 0;
    let pagesFetched = 0;
    let hasMoreActivities = true;

    while (hasMoreActivities && pagesFetched < maxPages) {
      try {
        const page = pagesFetched + 1;
        const beforePageMetrics = metrics.getCurrentMetrics();
        const fetchStart = Date.now();
        metrics.incrementApiRequests();
        const jellyfinActivities = await client.getActivities(
          startIndex,
          pageSize
        );
        const fetchMs = Date.now() - fetchStart;

        if (jellyfinActivities.length === 0) {
          hasMoreActivities = false;
          break;
        }

        console.info(
          `[activities-sync] server=${server.name} page=${page} startIndex=${startIndex} fetched=${jellyfinActivities.length} fetchMs=${fetchMs}`
        );

        const processStart = Date.now();
        // Process activities with controlled concurrency
        await pMap(
          jellyfinActivities,
          async (jellyfinActivity) => {
            try {
              await processActivity(jellyfinActivity, server.id, metrics);
            } catch (error) {
              console.error(
                `[activities-sync] server=${server.name} activityId=${jellyfinActivity.Id} status=error error=${formatError(
                  error
                )}`
              );
              metrics.incrementErrors();
              errors.push(
                `Activity ${jellyfinActivity.Id}: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              );
            }
          },
          { concurrency }
        );
        const processMs = Date.now() - processStart;

        const afterPageMetrics = metrics.getCurrentMetrics();
        const processedDelta =
          afterPageMetrics.activitiesProcessed -
          beforePageMetrics.activitiesProcessed;
        const insertedDelta =
          afterPageMetrics.activitiesInserted -
          beforePageMetrics.activitiesInserted;
        const updatedDelta =
          afterPageMetrics.activitiesUpdated -
          beforePageMetrics.activitiesUpdated;
        const errorsDelta = afterPageMetrics.errors - beforePageMetrics.errors;

        console.info(
          `[activities-sync] server=${server.name} page=${page} processed=${processedDelta} inserted=${insertedDelta} updated=${updatedDelta} errors=${errorsDelta} processMs=${processMs} totalProcessed=${afterPageMetrics.activitiesProcessed}`
        );

        startIndex += jellyfinActivities.length;
        pagesFetched++;

        // Add delay between API requests
        if (pagesFetched > 0 && apiRequestDelayMs > 0) {
          await sleep(apiRequestDelayMs);
        }

        // Stop if we got fewer activities than requested (indicates end of data)
        if (jellyfinActivities.length < pageSize) {
          hasMoreActivities = false;
        }
      } catch (error) {
        console.error(
          `[activities-sync] server=${server.name} page=${
            pagesFetched + 1
          } status=fetch-error error=${formatError(error)}`
        );
        metrics.incrementErrors();
        errors.push(
          `Page ${pagesFetched + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        break; // Stop processing on API error
      }
    }

    const finalMetrics = metrics.finish();
    const data: ActivitySyncData = {
      activitiesProcessed: finalMetrics.activitiesProcessed,
      activitiesInserted: finalMetrics.activitiesInserted,
      activitiesUpdated: finalMetrics.activitiesUpdated,
      pagesFetched,
    };

    console.info(
      formatSyncLogLine("activities-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: finalMetrics.activitiesInserted,
        updated: finalMetrics.activitiesUpdated,
        errors: errors.length,
        processMs: finalMetrics.duration ?? 0,
        totalProcessed: finalMetrics.activitiesProcessed,
        pagesFetched,
      })
    );

    if (errors.length > 0) {
      return createSyncResult("partial", data, finalMetrics, undefined, errors);
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      formatSyncLogLine("activities-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: 0,
        totalProcessed: metrics.getCurrentMetrics().activitiesProcessed,
        message: "Activities sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
    const finalMetrics = metrics.finish();
    const errorData: ActivitySyncData = {
      activitiesProcessed: finalMetrics.activitiesProcessed,
      activitiesInserted: finalMetrics.activitiesInserted,
      activitiesUpdated: finalMetrics.activitiesUpdated,
      pagesFetched: 0,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export async function syncRecentActivities(
  server: Server,
  options: ActivitySyncOptions = {}
): Promise<SyncResult<ActivitySyncData>> {
  const {
    pageSize = 1000,
    maxPages = 5000,
    concurrency = 2,
    apiRequestDelayMs = 300,
    intelligent = false,
  } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    console.info(
      formatSyncLogLine("recent-activities-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        action: "start",
        intelligent,
      })
    );

    let mostRecentDbActivityId: string | null = null;
    let foundLastKnownActivity = false;

    if (intelligent) {
      // Get the most recent activity ID from our database
      const lastActivity = await db
        .select({ id: activities.id, date: activities.date })
        .from(activities)
        .where(eq(activities.serverId, server.id))
        .orderBy(desc(activities.date))
        .limit(1);

      if (lastActivity.length > 0) {
        mostRecentDbActivityId = lastActivity[0].id;
        console.info(
          `[recent-activities-sync] server=${server.name} mostRecentActivityId=${mostRecentDbActivityId} mostRecentDate=${lastActivity[0].date}`
        );
      } else {
        console.info(
          `[recent-activities-sync] server=${server.name} status=no-existing-activities mode=full`
        );
      }
    }

    let startIndex = 0;
    let pagesFetched = 0;
    let activitiesProcessed = 0;

    while (pagesFetched < maxPages) {
      // Add delay between API requests
      if (pagesFetched > 0 && apiRequestDelayMs > 0) {
        await sleep(apiRequestDelayMs);
      }

      try {
        const page = pagesFetched + 1;
        const beforePageMetrics = metrics.getCurrentMetrics();
        const fetchStart = Date.now();
        metrics.incrementApiRequests();
        const jellyfinActivities = await client.getActivities(
          startIndex,
          pageSize
        );
        const fetchMs = Date.now() - fetchStart;

        if (jellyfinActivities.length === 0) {
          console.info(
            `[recent-activities-sync] server=${server.name} status=no-more-activities`
          );
          break;
        }

        console.info(
          `[recent-activities-sync] server=${server.name} page=${page} startIndex=${startIndex} fetched=${jellyfinActivities.length} fetchMs=${fetchMs} intelligent=${intelligent}`
        );

        // In intelligent mode, check if we've found our last known activity
        if (intelligent && mostRecentDbActivityId) {
          const foundIndex = jellyfinActivities.findIndex(
            (activity) => activity.Id === mostRecentDbActivityId
          );

          if (foundIndex >= 0) {
            console.info(
              `[recent-activities-sync] server=${server.name} foundAtIndex=${foundIndex} status=intelligent-stop`
            );
            // Only process activities before the found index (newer activities)
            const newActivities = jellyfinActivities.slice(0, foundIndex);
            if (newActivities.length > 0) {
              const processStart = Date.now();
              await pMap(
                newActivities,
                async (jellyfinActivity) => {
                  try {
                    await processActivity(jellyfinActivity, server.id, metrics);
                    activitiesProcessed++;
                  } catch (error) {
                    console.error(
                      `[recent-activities-sync] server=${server.name} activityId=${jellyfinActivity.Id} status=error error=${formatError(
                        error
                      )}`
                    );
                    metrics.incrementErrors();
                    errors.push(
                      `Activity ${jellyfinActivity.Id}: ${
                        error instanceof Error ? error.message : "Unknown error"
                      }`
                    );
                  }
                },
                { concurrency }
              );

              const processMs = Date.now() - processStart;
              const afterPageMetrics = metrics.getCurrentMetrics();
              const processedDelta =
                afterPageMetrics.activitiesProcessed -
                beforePageMetrics.activitiesProcessed;
              const insertedDelta =
                afterPageMetrics.activitiesInserted -
                beforePageMetrics.activitiesInserted;
              const updatedDelta =
                afterPageMetrics.activitiesUpdated -
                beforePageMetrics.activitiesUpdated;
              const errorsDelta =
                afterPageMetrics.errors - beforePageMetrics.errors;

              console.info(
                `[recent-activities-sync] server=${server.name} page=${page} processed=${processedDelta} inserted=${insertedDelta} updated=${updatedDelta} errors=${errorsDelta} processMs=${processMs} totalProcessed=${afterPageMetrics.activitiesProcessed} intelligentStop=true`
              );
            }
            foundLastKnownActivity = true;
            break;
          }
        }

        const processStart = Date.now();
        // Process all activities in the current page
        await pMap(
          jellyfinActivities,
          async (jellyfinActivity) => {
            try {
              await processActivity(jellyfinActivity, server.id, metrics);
              activitiesProcessed++;
            } catch (error) {
              console.error(
                `[recent-activities-sync] server=${server.name} activityId=${jellyfinActivity.Id} status=error error=${formatError(
                  error
                )}`
              );
              metrics.incrementErrors();
              errors.push(
                `Activity ${jellyfinActivity.Id}: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              );
            }
          },
          { concurrency }
        );
        const processMs = Date.now() - processStart;

        const afterPageMetrics = metrics.getCurrentMetrics();
        const processedDelta =
          afterPageMetrics.activitiesProcessed -
          beforePageMetrics.activitiesProcessed;
        const insertedDelta =
          afterPageMetrics.activitiesInserted -
          beforePageMetrics.activitiesInserted;
        const updatedDelta =
          afterPageMetrics.activitiesUpdated -
          beforePageMetrics.activitiesUpdated;
        const errorsDelta = afterPageMetrics.errors - beforePageMetrics.errors;

        console.info(
          `[recent-activities-sync] server=${server.name} page=${page} processed=${processedDelta} inserted=${insertedDelta} updated=${updatedDelta} errors=${errorsDelta} processMs=${processMs} totalProcessed=${afterPageMetrics.activitiesProcessed}`
        );

        startIndex += jellyfinActivities.length;
        pagesFetched++;

        // In intelligent mode, if we haven't found the last known activity yet,
        // but we've processed a reasonable amount, stop to prevent infinite loops
        if (
          intelligent &&
          !foundLastKnownActivity &&
          activitiesProcessed >= pageSize * 3
        ) {
          console.info(
            `[recent-activities-sync] server=${server.name} processed=${activitiesProcessed} status=intelligent-limit-reached`
          );
          break;
        }

        // Stop if we got fewer activities than requested (indicates end of data)
        if (jellyfinActivities.length < pageSize) {
          console.info(
            `[recent-activities-sync] server=${server.name} status=end-of-data`
          );
          break;
        }
      } catch (error) {
        console.error(
          `[recent-activities-sync] server=${server.name} page=${
            pagesFetched + 1
          } status=fetch-error error=${formatError(error)}`
        );
        metrics.incrementErrors();
        errors.push(
          `Page ${pagesFetched + 1}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        break; // Stop processing on API error
      }
    }

    const finalMetrics = metrics.finish();
    const data: ActivitySyncData = {
      activitiesProcessed: finalMetrics.activitiesProcessed,
      activitiesInserted: finalMetrics.activitiesInserted,
      activitiesUpdated: finalMetrics.activitiesUpdated,
      pagesFetched,
    };

    console.info(
      formatSyncLogLine("recent-activities-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: finalMetrics.activitiesInserted,
        updated: finalMetrics.activitiesUpdated,
        errors: errors.length,
        processMs: finalMetrics.duration ?? 0,
        totalProcessed: finalMetrics.activitiesProcessed,
        pagesFetched,
        intelligent,
      })
    );

    if (intelligent && mostRecentDbActivityId && !foundLastKnownActivity) {
      console.info(
        formatSyncLogLine("recent-activities-sync", {
          server: server.name,
          page: -1,
          processed: 0,
          inserted: 0,
          updated: 0,
          errors: 0,
          processMs: 0,
          totalProcessed: finalMetrics.activitiesProcessed,
          intelligent,
          message: "Intelligent sync did not find last known activity",
          lastKnownActivityId: mostRecentDbActivityId,
        })
      );
    }

    if (errors.length > 0) {
      return createSyncResult("partial", data, finalMetrics, undefined, errors);
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      formatSyncLogLine("recent-activities-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 1,
        processMs: 0,
        totalProcessed: metrics.getCurrentMetrics().activitiesProcessed,
        intelligent,
        message: "Recent activities sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
    const finalMetrics = metrics.finish();
    const errorData: ActivitySyncData = {
      activitiesProcessed: finalMetrics.activitiesProcessed,
      activitiesInserted: finalMetrics.activitiesInserted,
      activitiesUpdated: finalMetrics.activitiesUpdated,
      pagesFetched: 0,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function processActivity(
  jellyfinActivity: JellyfinActivity,
  serverId: number,
  metrics: SyncMetricsTracker
): Promise<void> {
  // Check if activity already exists
  const existingActivity = await db
    .select()
    .from(activities)
    .where(eq(activities.id, jellyfinActivity.Id))
    .limit(1);

  const isNewActivity = existingActivity.length === 0;

  // Validate userId - check if user exists in our database
  let validUserId: string | null = null;
  if (jellyfinActivity.UserId) {
    try {
      const userExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, jellyfinActivity.UserId))
        .limit(1);

      if (userExists.length > 0) {
        validUserId = jellyfinActivity.UserId;
      } else if (jellyfinActivity.UserId == ACTIVITYLOG_SYSTEM_USERID) {
        // this is a system event (plugin install/uninstall, ...) we do not print a warning
      }
    } catch (error) {
      console.warn(
        `[activities-sync] activityId=${jellyfinActivity.Id} status=user-check-error userId=null error=${formatError(
          error
        )}`
      );
    }
  }

  const activityData: NewActivity = {
    id: jellyfinActivity.Id,
    name: jellyfinActivity.Name,
    shortOverview: jellyfinActivity.ShortOverview || null,
    type: jellyfinActivity.Type,
    date: new Date(jellyfinActivity.Date),
    severity: jellyfinActivity.Severity,
    serverId,
    userId: validUserId,
    itemId: jellyfinActivity.ItemId || null,
  };

  // Upsert activity (insert or update if exists)
  await db
    .insert(activities)
    .values(activityData)
    .onConflictDoUpdate({
      target: activities.id,
      set: {
        ...activityData,
      },
    });

  metrics.incrementDatabaseOperations();

  if (isNewActivity) {
    metrics.incrementActivitiesInserted();
  } else {
    metrics.incrementActivitiesUpdated();
  }

  metrics.incrementActivitiesProcessed();
}
