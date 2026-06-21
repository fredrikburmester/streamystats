import { Hono } from "hono";
import {
  db,
  servers,
  serverJobConfigurations,
  JOB_DEFAULTS,
  JOB_KEYS,
  isValidJobKey,
  isCronJob,
  isIntervalJob,
  type JobKey,
} from "@streamystats/database";
import { activityScheduler } from "../../jobs/scheduler";
import { sessionPoller } from "../../jobs/session-poller";
import { eq, and } from "drizzle-orm";
import { getServerById } from "./utils";

const app = new Hono();

app.get("/scheduler/status", async (c) => {
  try {
    const status = activityScheduler.getStatus();
    return c.json({ success: true, scheduler: status });
  } catch (error) {
    console.error("Error getting scheduler status:", error);
    return c.json({ error: "Failed to get scheduler status" }, 500);
  }
});

app.post("/scheduler/trigger", async (c) => {
  try {
    const { serverId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const server = await getServerById(serverId);
    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    await activityScheduler.triggerServerActivitySync(server.id);

    return c.json({
      success: true,
      message: `Activity sync triggered for server: ${server.name}`,
    });
  } catch (error) {
    console.error("Error triggering activity sync:", error);
    return c.json({ error: "Failed to trigger activity sync" }, 500);
  }
});

app.post("/scheduler/trigger-user-sync", async (c) => {
  try {
    const { serverId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const server = await getServerById(serverId);
    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    await activityScheduler.triggerServerUserSync(server.id);

    return c.json({
      success: true,
      message: `User sync triggered for server: ${server.name}`,
    });
  } catch (error) {
    console.error("Error triggering user sync:", error);
    return c.json({ error: "Failed to trigger user sync" }, 500);
  }
});

app.post("/scheduler/trigger-full-sync", async (c) => {
  try {
    const { serverId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const server = await getServerById(serverId);
    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    await activityScheduler.triggerServerFullSync(server.id);

    return c.json({
      success: true,
      message: `Full sync triggered for server: ${server.name}`,
    });
  } catch (error) {
    console.error("Error triggering full sync:", error);
    return c.json({ error: "Failed to trigger full sync" }, 500);
  }
});

app.post("/scheduler/trigger-people-sync", async (c) => {
  try {
    const { serverId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const server = await getServerById(serverId);
    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    await activityScheduler.triggerServerPeopleSync(server.id);

    return c.json({
      success: true,
      message: `People sync triggered for server: ${server.name}`,
    });
  } catch (error) {
    console.error("Error triggering people sync:", error);
    return c.json({ error: "Failed to trigger people sync" }, 500);
  }
});

app.post("/scheduler/trigger-library-sync", async (c) => {
  try {
    const { serverId, libraryId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    if (!libraryId) {
      return c.json({ error: "Library ID is required" }, 400);
    }

    const server = await getServerById(serverId);
    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    await activityScheduler.triggerLibraryItemsSync(server.id, libraryId);

    return c.json({
      success: true,
      message: `Library sync triggered for server: ${server.name}`,
    });
  } catch (error) {
    console.error("Error triggering library sync:", error);
    return c.json({ error: "Failed to trigger library sync" }, 500);
  }
});

app.post("/scheduler/trigger-user-embeddings-sync", async (c) => {
  try {
    const { serverId } = await c.req.json();

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const server = await getServerById(serverId);
    if (!server) {
      return c.json({ error: "Server not found" }, 404);
    }

    await activityScheduler.triggerServerUserEmbeddingsSync(server.id);

    return c.json({
      success: true,
      message: `User embeddings sync triggered for server: ${server.name}`,
    });
  } catch (error) {
    console.error("Error triggering user embeddings sync:", error);
    return c.json({ error: "Failed to trigger user embeddings sync" }, 500);
  }
});

app.post("/scheduler/config", async (c) => {
  try {
    const body = await c.req.json();
    const {
      activitySyncInterval,
      recentItemsSyncInterval,
      userSyncInterval,
      fullSyncInterval,
      enabled,
    } = body;

    const config: Record<string, string | boolean> = {};

    const isValidCron = (expr: string) =>
      /^(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)$/.test(
        expr
      );

    if (typeof activitySyncInterval === "string") {
      if (!isValidCron(activitySyncInterval)) {
        return c.json(
          { error: "Invalid activity sync cron expression format" },
          400
        );
      }
      config.activitySyncInterval = activitySyncInterval;
    }

    if (typeof recentItemsSyncInterval === "string") {
      if (!isValidCron(recentItemsSyncInterval)) {
        return c.json(
          { error: "Invalid recent items sync cron expression format" },
          400
        );
      }
      config.recentItemsSyncInterval = recentItemsSyncInterval;
    }

    if (typeof userSyncInterval === "string") {
      if (!isValidCron(userSyncInterval)) {
        return c.json(
          { error: "Invalid user sync cron expression format" },
          400
        );
      }
      config.userSyncInterval = userSyncInterval;
    }

    if (typeof fullSyncInterval === "string") {
      if (!isValidCron(fullSyncInterval)) {
        return c.json(
          { error: "Invalid full sync cron expression format" },
          400
        );
      }
      config.fullSyncInterval = fullSyncInterval;
    }

    if (typeof enabled === "boolean") {
      config.enabled = enabled;
    }

    if (Object.keys(config).length === 0) {
      return c.json({ error: "No valid configuration provided" }, 400);
    }

    activityScheduler.updateConfig(config);
    const newStatus = activityScheduler.getStatus();

    return c.json({
      success: true,
      message: "Scheduler configuration updated",
      scheduler: newStatus,
    });
  } catch (error) {
    console.error("Error updating scheduler config:", error);
    return c.json({ error: "Failed to update scheduler configuration" }, 500);
  }
});

// Helper to validate cron expressions
const isValidCron = (expr: string) =>
  /^(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)$/.test(
    expr
  );

// Get all job configs for a server (merged with defaults)
app.get("/servers/:serverId/config", async (c) => {
  try {
    const serverId = Number.parseInt(c.req.param("serverId"), 10);

    if (Number.isNaN(serverId)) {
      return c.json({ error: "Invalid server ID" }, 400);
    }

    // Get server to verify it exists
    const server = await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!server.length) {
      return c.json({ error: "Server not found" }, 404);
    }

    // Get all custom configs for this server
    const customConfigs = await db
      .select()
      .from(serverJobConfigurations)
      .where(eq(serverJobConfigurations.serverId, serverId));

    // Build config map from custom configs
    const configMap = new Map(
      customConfigs.map((cfg) => [cfg.jobKey, cfg])
    );

    // Merge with defaults
    const configs = JOB_KEYS.map((jobKey) => {
      const defaultConfig = JOB_DEFAULTS[jobKey];
      const customConfig = configMap.get(jobKey);

      const baseConfig = {
        jobKey,
        label: defaultConfig.label,
        description: defaultConfig.description,
        category: defaultConfig.category,
        type: defaultConfig.type,
        enabled: customConfig?.enabled ?? true,
      };

      if (defaultConfig.type === "cron") {
        return {
          ...baseConfig,
          defaultCron: defaultConfig.defaultCron,
          cronExpression: customConfig?.cronExpression ?? null,
          isUsingDefault: !customConfig?.cronExpression,
        };
      } else {
        return {
          ...baseConfig,
          defaultInterval: defaultConfig.defaultInterval,
          intervalSeconds: customConfig?.intervalSeconds ?? null,
          isUsingDefault: customConfig?.intervalSeconds === null || customConfig?.intervalSeconds === undefined,
        };
      }
    });

    return c.json({
      success: true,
      serverId,
      configs,
    });
  } catch (error) {
    console.error("Error getting server job configs:", error);
    return c.json({ error: "Failed to get job configurations" }, 500);
  }
});

// Update job config for a server
app.put("/servers/:serverId/config/:jobKey", async (c) => {
  try {
    const serverId = Number.parseInt(c.req.param("serverId"), 10);
    const jobKey = c.req.param("jobKey");

    if (Number.isNaN(serverId)) {
      return c.json({ error: "Invalid server ID" }, 400);
    }

    if (!isValidJobKey(jobKey)) {
      return c.json({ error: "Invalid job key" }, 400);
    }

    // Verify server exists
    const server = await db
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!server.length) {
      return c.json({ error: "Server not found" }, 404);
    }

    const body = await c.req.json();
    const { cronExpression, intervalSeconds, enabled } = body;
    const defaultConfig = JOB_DEFAULTS[jobKey as JobKey];

    // Validate based on job type
    if (isCronJob(jobKey as JobKey)) {
      if (cronExpression !== undefined && cronExpression !== null) {
        if (typeof cronExpression !== "string" || !isValidCron(cronExpression)) {
          return c.json({ error: "Invalid cron expression format" }, 400);
        }
      }
    } else if (isIntervalJob(jobKey as JobKey)) {
      if (intervalSeconds !== undefined && intervalSeconds !== null) {
        if (typeof intervalSeconds !== "number" || intervalSeconds < 1) {
          return c.json({ error: "intervalSeconds must be a positive number" }, 400);
        }
      }
    }

    // Validate enabled if provided
    if (enabled !== undefined && typeof enabled !== "boolean") {
      return c.json({ error: "enabled must be a boolean" }, 400);
    }

    // Upsert the configuration
    const now = new Date();
    const existingConfig = await db
      .select()
      .from(serverJobConfigurations)
      .where(
        and(
          eq(serverJobConfigurations.serverId, serverId),
          eq(serverJobConfigurations.jobKey, jobKey)
        )
      )
      .limit(1);

    if (existingConfig.length > 0) {
      // Update existing
      const updateData: Record<string, unknown> = {
        enabled: enabled ?? existingConfig[0].enabled,
        updatedAt: now,
      };

      if (isCronJob(jobKey as JobKey)) {
        updateData.cronExpression = cronExpression ?? existingConfig[0].cronExpression;
      } else if (isIntervalJob(jobKey as JobKey)) {
        updateData.intervalSeconds = intervalSeconds ?? existingConfig[0].intervalSeconds;
      }

      await db
        .update(serverJobConfigurations)
        .set(updateData)
        .where(eq(serverJobConfigurations.id, existingConfig[0].id));
    } else {
      // Insert new
      await db.insert(serverJobConfigurations).values({
        serverId,
        jobKey,
        enabled: enabled ?? true,
        cronExpression: isCronJob(jobKey as JobKey) ? (cronExpression ?? null) : null,
        intervalSeconds: isIntervalJob(jobKey as JobKey) ? (intervalSeconds ?? null) : null,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Notify scheduler and session poller to reload configs
    if (isCronJob(jobKey as JobKey)) {
      await activityScheduler.reloadServerConfig(serverId);
    } else if (isIntervalJob(jobKey as JobKey)) {
      await sessionPoller.reloadServerConfig(serverId);
    }

    const baseResponse = {
      jobKey,
      label: defaultConfig.label,
      type: defaultConfig.type,
      enabled: enabled ?? true,
    };

    const response = isCronJob(jobKey as JobKey)
      ? {
          ...baseResponse,
          cronExpression: cronExpression ?? null,
          isUsingDefault: !cronExpression,
        }
      : {
          ...baseResponse,
          intervalSeconds: intervalSeconds ?? null,
          isUsingDefault: intervalSeconds === null || intervalSeconds === undefined,
        };

    return c.json({
      success: true,
      config: response,
    });
  } catch (error) {
    console.error("Error updating server job config:", error);
    return c.json({ error: "Failed to update job configuration" }, 500);
  }
});

// Reset job config to default (delete override)
app.delete("/servers/:serverId/config/:jobKey", async (c) => {
  try {
    const serverId = Number.parseInt(c.req.param("serverId"), 10);
    const jobKey = c.req.param("jobKey");

    if (Number.isNaN(serverId)) {
      return c.json({ error: "Invalid server ID" }, 400);
    }

    if (!isValidJobKey(jobKey)) {
      return c.json({ error: "Invalid job key" }, 400);
    }

    // Delete the custom configuration
    await db
      .delete(serverJobConfigurations)
      .where(
        and(
          eq(serverJobConfigurations.serverId, serverId),
          eq(serverJobConfigurations.jobKey, jobKey)
        )
      );

    // Notify the appropriate service to reload configs
    if (isCronJob(jobKey as JobKey)) {
      await activityScheduler.reloadServerConfig(serverId);
    } else if (isIntervalJob(jobKey as JobKey)) {
      await sessionPoller.reloadServerConfig(serverId);
    }

    const defaultConfig = JOB_DEFAULTS[jobKey as JobKey];

    const baseConfig = {
      jobKey,
      label: defaultConfig.label,
      type: defaultConfig.type,
      enabled: true,
      isUsingDefault: true,
    };

    const config = isCronJob(jobKey as JobKey)
      ? {
          ...baseConfig,
          cronExpression: null,
          defaultCron: (defaultConfig as { defaultCron: string }).defaultCron,
        }
      : {
          ...baseConfig,
          intervalSeconds: null,
          defaultInterval: (defaultConfig as { defaultInterval: number }).defaultInterval,
        };

    return c.json({
      success: true,
      message: `Job configuration reset to default`,
      config,
    });
  } catch (error) {
    console.error("Error resetting server job config:", error);
    return c.json({ error: "Failed to reset job configuration" }, 500);
  }
});

export default app;
