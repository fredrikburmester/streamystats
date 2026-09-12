import { Hono } from "hono";
import { getJobQueue, JobTypes, latestQueueStats } from "../../jobs/queue";
import { JELLYFIN_JOB_NAMES } from "../../jellyfin/workers";
import {
  db,
  servers,
  jobResults,
  type JobResult,
} from "@streamystats/database";
import { activityScheduler } from "../../jobs/scheduler";
import { sessionPoller } from "../../jobs/session-poller";
import { eq, desc, sql } from "drizzle-orm";
import type {
  JobStatus,
  ServerJobState,
  ServerJobStatusItem,
} from "../../types/job-status";
import { toIsoUtcMicros } from "./utils";

type PgBossJobState =
  | "created"
  | "retry"
  | "active"
  | "completed"
  | "expired"
  | "cancelled"
  | "failed";

interface ServerJobQueryRow {
  name: string;
  has_active: boolean;
  has_queued: boolean;
  latest_state: PgBossJobState;
  latest_id: string;
  latest_created_on: Date;
  latest_completed_on: Date | null;
  latest_output: unknown;
  active_id: string | null;
  active_started_on: Date | null;
  queued_id: string | null;
  queued_created_on: Date | null;
  queued_start_after: Date | null;
}

const app = new Hono();

app.get("/servers/:serverId/status", async (c) => {
  try {
    const rawServerId = c.req.param("serverId");
    const serverId = Number(rawServerId);

    if (!Number.isFinite(serverId)) {
      return c.json({ error: "Invalid serverId" }, 400);
    }

    const jobDefinitions: Array<{
      key: string;
      label: string;
      name: string;
      category: "foreground" | "background";
    }> = [
      {
        key: "generate-item-embeddings",
        label: "Embeddings",
        name: JobTypes.GENERATE_ITEM_EMBEDDINGS,
        category: "foreground",
      },
      {
        key: "jellyfin-full-sync",
        label: "Jellyfin full sync",
        name: JELLYFIN_JOB_NAMES.FULL_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-users-sync",
        label: "Jellyfin users",
        name: JELLYFIN_JOB_NAMES.USERS_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-libraries-sync",
        label: "Jellyfin libraries",
        name: JELLYFIN_JOB_NAMES.LIBRARIES_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-items-sync",
        label: "Jellyfin items",
        name: JELLYFIN_JOB_NAMES.ITEMS_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-activities-sync",
        label: "Jellyfin activities",
        name: JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-recent-items-sync",
        label: "Jellyfin recent items",
        name: JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-recent-activities-sync",
        label: "Jellyfin recent activities",
        name: JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC,
        category: "background",
      },
      {
        key: "jellyfin-people-sync",
        label: "Jellyfin people",
        name: JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
        category: "background",
      },
    ];

    const jobNames = jobDefinitions.map((j) => j.name);
    const jobNameList = sql.join(
      jobNames.map((n) => sql`${n}`),
      sql`, `
    );

    const rows = (await db.execute(
      sql`
        with base as (
          select
            name,
            id,
            state,
            created_on,
            started_on,
            start_after,
            completed_on,
            output
          from pgboss.job
          where
            name in (${jobNameList})
            and (data->>'serverId')::int = ${serverId}
        ),
        flags as (
          select
            name,
            bool_or(state = 'active') as has_active,
            bool_or(state in ('created', 'retry')) as has_queued
          from base
          group by name
        ),
        latest as (
          select distinct on (name)
            name,
            id as latest_id,
            state as latest_state,
            created_on as latest_created_on,
            completed_on as latest_completed_on,
            output as latest_output
          from base
          order by name, created_on desc
        ),
        active as (
          select distinct on (name)
            name,
            id as active_id,
            started_on as active_started_on
          from base
          where state = 'active'
          order by name, started_on desc
        ),
        queued as (
          select distinct on (name)
            name,
            id as queued_id,
            created_on as queued_created_on,
            start_after as queued_start_after
          from base
          where state in ('created', 'retry')
          order by name, created_on desc
        )
        select
          latest.name,
          flags.has_active,
          flags.has_queued,
          latest.latest_state,
          latest.latest_id,
          latest.latest_created_on,
          latest.latest_completed_on,
          latest.latest_output,
          active.active_id,
          active.active_started_on,
          queued.queued_id,
          queued.queued_created_on,
          queued.queued_start_after
        from latest
        join flags using (name)
        left join active using (name)
        left join queued using (name)
      `
    )) as unknown as ServerJobQueryRow[];

    const byName = new Map(rows.map((r) => [r.name, r]));

    const jobs: ServerJobStatusItem[] = jobDefinitions.map((def) => {
      const row = byName.get(def.name);
      if (!row) {
        return {
          key: def.key,
          label: def.label,
          state: "stopped",
          updatedAt: toIsoUtcMicros(new Date()),
        };
      }

      let state: ServerJobState = "stopped";
      let jobId: string | undefined;

      if (row.has_active) {
        state = "running";
        jobId = row.active_id ?? row.latest_id;
      } else if (row.has_queued) {
        const startAfter = row.queued_start_after
          ? new Date(row.queued_start_after).getTime()
          : undefined;
        state = startAfter && startAfter > Date.now() ? "scheduled" : "queued";
        jobId = row.queued_id ?? row.latest_id;
      } else if (
        row.latest_state === "failed" ||
        row.latest_state === "expired"
      ) {
        state = "failed";
      } else if (row.latest_state === "cancelled") {
        state = "cancelled";
      } else {
        state = "stopped";
      }

      const updatedAtSource =
        row.active_started_on ??
        row.queued_start_after ??
        row.queued_created_on ??
        row.latest_completed_on ??
        row.latest_created_on;

      let lastError: string | undefined;
      if (
        state === "failed" &&
        row.latest_output &&
        typeof row.latest_output === "object"
      ) {
        const output = row.latest_output as Record<string, unknown>;
        const message =
          typeof output.message === "string"
            ? output.message
            : typeof output.error === "string"
            ? output.error
            : undefined;
        lastError = message;
      }

      return {
        key: def.key,
        label: def.label,
        state,
        updatedAt: toIsoUtcMicros(new Date(updatedAtSource)),
        ...(state === "running" && row.active_started_on
          ? { activeSince: toIsoUtcMicros(new Date(row.active_started_on)) }
          : {}),
        ...(state === "scheduled" && row.queued_start_after
          ? { scheduledFor: toIsoUtcMicros(new Date(row.queued_start_after)) }
          : {}),
        ...(jobId ? { jobId } : {}),
        ...(lastError ? { lastError } : {}),
      };
    });

    return c.json({
      success: true,
      timestamp: toIsoUtcMicros(new Date()),
      serverId,
      jobs,
    });
  } catch (error) {
    console.error("Error fetching server job status:", error);
    return c.json(
      {
        error: "Failed to fetch server job status",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/server-status", async (c) => {
  try {
    const boss = await getJobQueue();

    const queueStats = await Promise.all([
      boss.getQueueStats(JobTypes.ADD_SERVER),
      boss.getQueueStats(JobTypes.GENERATE_ITEM_EMBEDDINGS),
    ]);
    const queueSizes = queueStats.map((s) => latestQueueStats(s)?.queuedCount ?? 0);

    const jellyfinQueueStats = await Promise.all([
      boss.getQueueStats(JELLYFIN_JOB_NAMES.FULL_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.USERS_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.LIBRARIES_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.ITEMS_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC),
      boss.getQueueStats(JELLYFIN_JOB_NAMES.PEOPLE_SYNC),
    ]);
    const jellyfinQueueSizes = jellyfinQueueStats.map(
      (s) => latestQueueStats(s)?.queuedCount ?? 0,
    );

    const allServers = await db
      .select({
        id: servers.id,
        name: servers.name,
        url: servers.url,
        syncStatus: servers.syncStatus,
        syncProgress: servers.syncProgress,
        syncError: servers.syncError,
        lastSyncStarted: servers.lastSyncStarted,
        lastSyncCompleted: servers.lastSyncCompleted,
        createdAt: servers.createdAt,
        updatedAt: servers.updatedAt,
      })
      .from(servers);

    const schedulerStatus = activityScheduler.getStatus();
    const sessionPollerStatus = sessionPoller.getStatus();

    const recentJobResults = await db
      .select()
      .from(jobResults)
      .orderBy(desc(jobResults.createdAt))
      .limit(10);

    const jobStatusMap: Record<string, JobStatus> = {};

    const dbJobResults = await db
      .select()
      .from(jobResults)
      .orderBy(desc(jobResults.createdAt))
      .limit(100);

    const jobGroups: Record<string, { status: JobStatus; createdAt: Date }> =
      {};

    for (const result of dbJobResults) {
      const resultJobName = result.jobName;
      const resultDate = new Date(result.createdAt);

      if (
        !jobGroups[resultJobName] ||
        resultDate > jobGroups[resultJobName].createdAt
      ) {
        jobGroups[resultJobName] = {
          status: result.status as JobStatus,
          createdAt: resultDate,
        };
      }
    }

    for (const [resultJobName, jobInfo] of Object.entries(jobGroups)) {
      jobStatusMap[resultJobName] = jobInfo.status;
    }

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      queueStats: {
        addServer: queueSizes[0],
        generateItemEmbeddings: queueSizes[1],
        jellyfinFullSync: jellyfinQueueSizes[0],
        jellyfinUsersSync: jellyfinQueueSizes[1],
        jellyfinLibrariesSync: jellyfinQueueSizes[2],
        jellyfinItemsSync: jellyfinQueueSizes[3],
        jellyfinActivitiesSync: jellyfinQueueSizes[4],
        jellyfinRecentItemsSync: jellyfinQueueSizes[5],
        jellyfinRecentActivitiesSync: jellyfinQueueSizes[6],
        jellyfinPeopleSync: jellyfinQueueSizes[7],
        totalQueued: [...queueSizes, ...jellyfinQueueSizes].reduce(
          (sum, stat) => sum + stat,
          0
        ),
        standardJobsQueued: queueSizes.reduce((sum, stat) => sum + stat, 0),
        jellyfinJobsQueued: jellyfinQueueSizes.reduce(
          (sum, stat) => sum + stat,
          0
        ),
      },
      jobStatusMap,
      servers: {
        total: allServers.length,
        byStatus: {
          pending: allServers.filter((s) => s.syncStatus === "pending").length,
          syncing: allServers.filter((s) => s.syncStatus === "syncing").length,
          completed: allServers.filter((s) => s.syncStatus === "completed")
            .length,
          failed: allServers.filter((s) => s.syncStatus === "failed").length,
        },
        list: allServers.map((server) => ({
          id: server.id,
          name: server.name,
          url: server.url,
          syncStatus: server.syncStatus,
          syncProgress: server.syncProgress,
          syncError: server.syncError,
          lastSyncStarted: server.lastSyncStarted,
          lastSyncCompleted: server.lastSyncCompleted,
          isHealthy: server.syncStatus !== "failed",
          needsAttention:
            server.syncStatus === "failed" ||
            (server.syncStatus === "syncing" &&
              server.lastSyncStarted &&
              Date.now() - new Date(server.lastSyncStarted).getTime() >
                30 * 60 * 1000),
        })),
      },
      scheduler: {
        ...schedulerStatus,
      },
      sessionPoller: {
        ...sessionPollerStatus,
        healthCheck:
          sessionPollerStatus.enabled && sessionPollerStatus.isRunning,
      },
      recentResults: recentJobResults.map((result: JobResult) => ({
        id: result.id,
        jobName: result.jobName,
        status: result.status,
        createdAt: result.createdAt,
        error: result.error,
        processingTime: result.processingTime,
      })),
      systemHealth: {
        overall: "healthy" as "healthy" | "warning" | "unhealthy",
        issues: [] as string[],
        warnings: [] as string[],
      },
    };

    const issues: string[] = [];
    const warnings: string[] = [];

    const failedServers = allServers.filter((s) => s.syncStatus === "failed");
    if (failedServers.length > 0) {
      issues.push(`${failedServers.length} server(s) have failed sync status`);
    }

    const stuckSyncingServers = allServers.filter(
      (s) =>
        s.syncStatus === "syncing" &&
        s.lastSyncStarted &&
        Date.now() - new Date(s.lastSyncStarted).getTime() > 30 * 60 * 1000
    );
    if (stuckSyncingServers.length > 0) {
      warnings.push(
        `${stuckSyncingServers.length} server(s) may be stuck in syncing state`
      );
    }

    if (!schedulerStatus.enabled) {
      issues.push("Activity scheduler is disabled");
    }

    if (!sessionPollerStatus.enabled || !sessionPollerStatus.isRunning) {
      issues.push("Session poller is not running");
    }

    const totalQueuedJobs = response.queueStats.totalQueued;
    if (totalQueuedJobs > 100) {
      warnings.push(`High job queue volume: ${totalQueuedJobs} jobs queued`);
    }

    const recentFailedJobs = recentJobResults.filter(
      (result: JobResult) => result.status === "failed"
    );
    if (recentFailedJobs.length > 5) {
      warnings.push(
        `High number of recent failed jobs: ${recentFailedJobs.length}`
      );
    }

    const failedJobsInMap = Object.values(jobStatusMap).filter(
      (status) => status === "failed"
    ).length;
    if (failedJobsInMap > 10) {
      warnings.push(`High number of failed jobs: ${failedJobsInMap}`);
    }

    response.systemHealth.issues = issues;
    response.systemHealth.warnings = warnings;
    response.systemHealth.overall =
      issues.length > 0
        ? "unhealthy"
        : warnings.length > 0
        ? "warning"
        : "healthy";

    return c.json(response);
  } catch (error) {
    console.error("Error fetching server status:", error);
    return c.json(
      {
        error: "Failed to fetch server status",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default app;
