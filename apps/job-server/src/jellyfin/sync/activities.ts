import { eq, desc, inArray, sql } from "drizzle-orm";
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
    apiRequestDelayMs = 300,
  } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    console.info(
      `[activities-sync] server=${server.name} phase=start pageSize=${pageSize} apiRequestDelayMs=${apiRequestDelayMs}`
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
        // Process the whole page in 3 bulk queries instead of 3 queries per activity
        const pageResult = await processActivitiesPage(
          jellyfinActivities,
          server.id,
          metrics
        );
        const processMs = Date.now() - processStart;

        if (pageResult.errors.length > 0) {
          errors.push(...pageResult.errors);
        }

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
              const pageResult = await processActivitiesPage(
                newActivities,
                server.id,
                metrics
              );
              if (pageResult.errors.length > 0) {
                errors.push(...pageResult.errors);
              }
              // Use metrics delta so we only count successfully written activities
              activitiesProcessed +=
                metrics.getCurrentMetrics().activitiesProcessed -
                beforePageMetrics.activitiesProcessed;

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
        // Process the whole page in 3 bulk queries instead of 3 queries per activity
        const pageResult = await processActivitiesPage(
          jellyfinActivities,
          server.id,
          metrics
        );
        if (pageResult.errors.length > 0) {
          errors.push(...pageResult.errors);
        }
        // Use metrics delta so we only count successfully written activities
        activitiesProcessed +=
          metrics.getCurrentMetrics().activitiesProcessed -
          beforePageMetrics.activitiesProcessed;
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

/**
 * Process a full page of activities using 3 bulk DB queries instead of
 * 3 queries per activity. This is the primary performance fix for large syncs.
 *
 * 1. Bulk SELECT existing activity IDs → determine insert vs update
 * 2. Bulk SELECT valid user IDs from the page's unique user IDs
 * 3. Single bulk INSERT ... ON CONFLICT DO UPDATE for all activities
 */
async function processActivitiesPage(
  jellyfinActivities: JellyfinActivity[],
  serverId: number,
  metrics: SyncMetricsTracker
): Promise<{ errors: string[] }> {
  if (jellyfinActivities.length === 0) {
    return { errors: [] };
  }

  const errors: string[] = [];

  try {
    const allIds = jellyfinActivities.map((a) => a.Id);

    // 1. Bulk check which activities already exist
    const existingRows = await db
      .select({ id: activities.id })
      .from(activities)
      .where(inArray(activities.id, allIds));
    const existingIds = new Set(existingRows.map((r) => r.id));

    // 2. Bulk validate user IDs (filter out nulls and system user)
    const uniqueUserIds = [
      ...new Set(
        jellyfinActivities
          .map((a) => a.UserId)
          .filter(
            (id): id is string =>
              !!id && id !== ACTIVITYLOG_SYSTEM_USERID
          )
      ),
    ];

    const validUserIds = new Set<string>();
    if (uniqueUserIds.length > 0) {
      const validRows = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, uniqueUserIds));
      for (const row of validRows) {
        validUserIds.add(row.id);
      }
    }

    // 3. Build all activity records and bulk upsert
    const activityValues: NewActivity[] = jellyfinActivities.map((a) => ({
      id: a.Id,
      name: a.Name,
      shortOverview: a.ShortOverview || null,
      type: a.Type,
      date: new Date(a.Date),
      severity: a.Severity,
      serverId,
      userId:
        a.UserId && validUserIds.has(a.UserId) ? a.UserId : null,
      itemId: a.ItemId || null,
    }));

    await db
      .insert(activities)
      .values(activityValues)
      .onConflictDoUpdate({
        target: activities.id,
        set: {
          name: sql`excluded.name`,
          shortOverview: sql`excluded.short_overview`,
          type: sql`excluded.type`,
          date: sql`excluded.date`,
          severity: sql`excluded.severity`,
          serverId: sql`excluded.server_id`,
          userId: sql`excluded.user_id`,
          itemId: sql`excluded.item_id`,
        },
      });

    metrics.incrementDatabaseOperations(3);

    const insertedCount = activityValues.filter(
      (a) => !existingIds.has(a.id)
    ).length;
    const updatedCount = activityValues.length - insertedCount;

    metrics.incrementActivitiesInserted(insertedCount);
    metrics.incrementActivitiesUpdated(updatedCount);
    metrics.incrementActivitiesProcessed(activityValues.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const sampleIds = jellyfinActivities.slice(0, 5).map((a) => a.Id).join(",");
    errors.push(`Batch upsert failed (ids=${sampleIds}...): ${message}`);
    metrics.incrementErrors();
  }

  return { errors };
}
