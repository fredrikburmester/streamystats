import { Hono } from "hono";
import { getJobQueue, JobTypes, latestQueueStats } from "../../jobs/queue";
import { JELLYFIN_JOB_NAMES } from "../../jellyfin/workers";
import { GEOLOCATION_JOB_NAMES } from "../../jobs/geolocation-jobs";
import { SECURITY_SYNC_JOB_NAME } from "../../jobs/security-sync-job";
import { db, jobResults } from "@streamystats/database";
import { eq, desc } from "drizzle-orm";
import { cancelJobsByName } from "./utils";

const app = new Hono();

// All job types that can be associated with a server
const ALL_SERVER_JOB_TYPES = [
  JobTypes.GENERATE_ITEM_EMBEDDINGS,
  ...Object.values(JELLYFIN_JOB_NAMES),
  ...Object.values(GEOLOCATION_JOB_NAMES),
  SECURITY_SYNC_JOB_NAME,
];

app.post("/cancel-by-type", async (c) => {
  try {
    const { jobType, serverId } = await c.req.json();

    if (!jobType) {
      return c.json({ error: "Job type is required" }, 400);
    }

    const validJobTypes = [
      JobTypes.ADD_SERVER,
      JobTypes.GENERATE_ITEM_EMBEDDINGS,
      ...Object.values(JELLYFIN_JOB_NAMES),
    ];

    if (!validJobTypes.includes(jobType)) {
      return c.json(
        { error: "Invalid job type", validTypes: validJobTypes },
        400
      );
    }

    const cancelledCount = await cancelJobsByName(jobType, serverId);

    return c.json({
      success: true,
      message: `Jobs of type "${jobType}" cancelled successfully. ${cancelledCount} jobs cancelled.`,
      cancelledCount,
      jobType,
      serverId: serverId || null,
    });
  } catch (error) {
    console.error("Error cancelling jobs by type:", error);
    return c.json(
      {
        error: "Failed to cancel jobs",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/cancel-all-for-server", async (c) => {
  try {
    const { serverId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const numericServerId = Number(serverId);
    if (!Number.isFinite(numericServerId)) {
      return c.json({ error: "Server ID must be a valid number" }, 400);
    }

    let totalCancelled = 0;
    const cancelledByType: Record<string, number> = {};

    for (const jobType of ALL_SERVER_JOB_TYPES) {
      try {
        const cancelled = await cancelJobsByName(jobType, numericServerId);
        if (cancelled > 0) {
          cancelledByType[jobType] = cancelled;
          totalCancelled += cancelled;
        }
      } catch {
        // Continue cancelling other job types even if one fails
      }
    }

    return c.json({
      success: true,
      message: `Cancelled ${totalCancelled} jobs for server ${numericServerId}`,
      totalCancelled,
      cancelledByType,
      serverId: numericServerId,
    });
  } catch (error) {
    console.error("Error cancelling all jobs for server:", error);
    return c.json(
      {
        error: "Failed to cancel jobs",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/queue/:queueName/:jobId/status", async (c) => {
  try {
    const queueName = c.req.param("queueName");
    const jobId = c.req.param("jobId");

    const boss = await getJobQueue();
    const job = await boss.getJobById(queueName, jobId);

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    return c.json({
      success: true,
      job: {
        id: job.id,
        name: job.name,
        state: job.state,
        data: job.data,
        output: job.output,
        createdOn: job.createdOn,
        startedOn: job.startedOn,
        completedOn: job.completedOn,
      },
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return c.json({ error: "Failed to fetch job status" }, 500);
  }
});

app.get("/results", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "20");
    const status = c.req.query("status");
    const jobName = c.req.query("jobName");

    if (status) {
      const results = await db
        .select()
        .from(jobResults)
        .where(eq(jobResults.status, status))
        .orderBy(desc(jobResults.createdAt))
        .limit(limit);

      return c.json({ success: true, results, count: results.length });
    }

    if (jobName) {
      const results = await db
        .select()
        .from(jobResults)
        .where(eq(jobResults.jobName, jobName))
        .orderBy(desc(jobResults.createdAt))
        .limit(limit);

      return c.json({ success: true, results, count: results.length });
    }

    const results = await db
      .select()
      .from(jobResults)
      .orderBy(desc(jobResults.createdAt))
      .limit(limit);

    return c.json({ success: true, results, count: results.length });
  } catch (error) {
    console.error("Error fetching job results:", error);
    return c.json({ error: "Failed to fetch job results" }, 500);
  }
});

app.get("/queue/stats", async (c) => {
  try {
    const boss = await getJobQueue();

    const stats = await Promise.all([
      boss.getQueueStats(JobTypes.ADD_SERVER),
      boss.getQueueStats(JobTypes.GENERATE_ITEM_EMBEDDINGS),
    ]);

    const queuedCounts = stats.map((s) => latestQueueStats(s)?.queuedCount ?? 0);

    return c.json({
      success: true,
      queueStats: {
        addServer: queuedCounts[0],
        generateItemEmbeddings: queuedCounts[1],
        total: queuedCounts.reduce((sum, count) => sum + count, 0),
      },
    });
  } catch (error) {
    console.error("Error fetching queue stats:", error);
    return c.json({ error: "Failed to fetch queue stats" }, 500);
  }
});

export default app;
