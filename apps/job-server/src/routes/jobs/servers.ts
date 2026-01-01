import { Hono } from "hono";
import { getJobQueue, JobTypes } from "../../jobs/queue";
import { JELLYFIN_JOB_NAMES } from "../../jellyfin/workers";
import { BACKFILL_JOB_NAMES } from "../../jobs/server-jobs";
import {
  db,
  servers,
  activities,
  users,
  libraries,
  buildAuthHeaders,
} from "@streamystats/database";
import { eq, desc } from "drizzle-orm";

interface JellyfinSystemInfo {
  Id?: string;
  ServerName?: string;
  Version?: string;
  ProductName?: string;
  OperatingSystem?: string;
  StartupWizardCompleted?: boolean;
  LocalAddress?: string;
}

const app = new Hono();

app.post("/add-server", async (c) => {
  try {
    const { name, url, apiKey } = await c.req.json();

    if (!name || !url || !apiKey) {
      return c.json({ error: "Name, URL, and API key are required" }, 400);
    }

    const boss = await getJobQueue();
    const jobId = await boss.send(JobTypes.ADD_SERVER, { name, url, apiKey });

    return c.json({
      success: true,
      jobId,
      message: "Add server job queued successfully",
    });
  } catch (error) {
    console.error("Error queuing add server job:", error);
    return c.json({ error: "Failed to queue job" }, 500);
  }
});

app.get("/servers", async (c) => {
  try {
    const serversList = await db
      .select()
      .from(servers)
      .orderBy(desc(servers.createdAt));

    return c.json({
      success: true,
      servers: serversList,
      count: serversList.length,
    });
  } catch (error) {
    console.error("Error fetching servers:", error);
    return c.json({ error: "Failed to fetch servers" }, 500);
  }
});

app.get("/servers/:serverId/users", async (c) => {
  try {
    const serverId = c.req.param("serverId");
    const usersList = await db
      .select()
      .from(users)
      .where(eq(users.serverId, parseInt(serverId)))
      .orderBy(desc(users.createdAt));

    return c.json({
      success: true,
      users: usersList,
      count: usersList.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

app.get("/servers/:serverId/libraries", async (c) => {
  try {
    const serverId = c.req.param("serverId");
    const librariesList = await db
      .select()
      .from(libraries)
      .where(eq(libraries.serverId, parseInt(serverId)))
      .orderBy(desc(libraries.createdAt));

    return c.json({
      success: true,
      libraries: librariesList,
      count: librariesList.length,
    });
  } catch (error) {
    console.error("Error fetching libraries:", error);
    return c.json({ error: "Failed to fetch libraries" }, 500);
  }
});

app.get("/servers/:serverId/activities", async (c) => {
  try {
    const serverId = c.req.param("serverId");
    const limit = parseInt(c.req.query("limit") || "50");

    const activitiesList = await db
      .select()
      .from(activities)
      .where(eq(activities.serverId, parseInt(serverId)))
      .orderBy(desc(activities.date))
      .limit(limit);

    return c.json({
      success: true,
      activities: activitiesList,
      count: activitiesList.length,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return c.json({ error: "Failed to fetch activities" }, 500);
  }
});

app.get("/servers/:serverId/sync-status", async (c) => {
  try {
    const serverId = c.req.param("serverId");

    const server = await db
      .select({
        id: servers.id,
        name: servers.name,
        syncStatus: servers.syncStatus,
        syncProgress: servers.syncProgress,
        syncError: servers.syncError,
        lastSyncStarted: servers.lastSyncStarted,
        lastSyncCompleted: servers.lastSyncCompleted,
      })
      .from(servers)
      .where(eq(servers.id, parseInt(serverId)))
      .limit(1);

    if (!server.length) {
      return c.json({ error: "Server not found" }, 404);
    }

    const serverData = server[0];

    const progressSteps = [
      "not_started",
      "users",
      "libraries",
      "items",
      "activities",
      "completed",
    ];
    const currentStepIndex = progressSteps.indexOf(serverData.syncProgress);
    const progressPercentage =
      currentStepIndex >= 0
        ? (currentStepIndex / (progressSteps.length - 1)) * 100
        : 0;

    const isReady =
      serverData.syncStatus === "completed" &&
      serverData.syncProgress === "completed";

    return c.json({
      success: true,
      server: {
        ...serverData,
        progressPercentage: Math.round(progressPercentage),
        isReady,
        canRedirect: isReady,
      },
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    return c.json(
      {
        error: "Failed to get sync status",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/create-server", async (c) => {
  try {
    const body = await c.req.json();
    const { name, url, apiKey, ...otherFields } = body;

    if (!name || !url || !apiKey) {
      return c.json({ error: "Name, URL, and API key are required" }, 400);
    }

    try {
      // Use legacy auth (null version) since we don't know the server version yet
      const testResponse = await fetch(`${url}/System/Info`, {
        headers: buildAuthHeaders(apiKey, null, { appContext: "job-server" }),
      });

      if (!testResponse.ok) {
        let errorMessage = "Failed to connect to server.";
        if (testResponse.status === 401) {
          errorMessage = "Invalid API key. Please check your Jellyfin API key.";
        } else if (testResponse.status === 404) {
          errorMessage = "Server not found. Please check the URL.";
        } else if (testResponse.status === 403) {
          errorMessage =
            "Access denied. Please check your API key permissions.";
        } else if (testResponse.status >= 500) {
          errorMessage =
            "Server error. Please check if Jellyfin server is running properly.";
        } else {
          errorMessage = `Failed to connect to server (${testResponse.status}). Please check URL and API key.`;
        }

        return c.json({ error: errorMessage }, 400);
      }

      const serverInfo = (await testResponse.json()) as JellyfinSystemInfo;

      const existingServer = await db
        .select({ id: servers.id, name: servers.name })
        .from(servers)
        .where(eq(servers.url, url))
        .limit(1);

      if (existingServer.length > 0) {
        return c.json(
          {
            error: "A server with this URL already exists",
            existingServer: existingServer[0],
          },
          409
        );
      }

      const newServer = {
        name: serverInfo.ServerName || name,
        url,
        apiKey,
        jellyfinId: serverInfo.Id,
        version: serverInfo.Version,
        productName: serverInfo.ProductName,
        operatingSystem: serverInfo.OperatingSystem,
        startupWizardCompleted: serverInfo.StartupWizardCompleted || false,
        syncStatus: "pending" as const,
        syncProgress: "not_started" as const,
        ...otherFields,
      };

      const [createdServer] = await db
        .insert(servers)
        .values(newServer)
        .returning();

      const boss = await getJobQueue();
      const jobId = await boss.send(
        JELLYFIN_JOB_NAMES.FULL_SYNC,
        {
          serverId: createdServer.id,
          options: {
            userOptions: {},
            libraryOptions: {},
            itemOptions: {},
            activityOptions: {
              pageSize: 5000,
              maxPages: 5000,
              concurrency: 5,
              apiRequestDelayMs: 100,
            },
          },
        },
        {
          expireInSeconds: 21600,
          retryLimit: 1,
          retryDelay: 300,
        }
      );

      return c.json(
        {
          success: true,
          server: createdServer,
          syncJobId: jobId,
          message: "Server created successfully. Sync has been started.",
        },
        201
      );
    } catch (connectionError) {
      let errorMessage = "Failed to connect to server.";

      if (connectionError instanceof Error) {
        const message = connectionError.message.toLowerCase();
        if (
          message.includes("fetch failed") ||
          message.includes("econnrefused")
        ) {
          errorMessage =
            "Cannot reach server. Please check the URL and ensure the server is running.";
        } else if (
          message.includes("getaddrinfo notfound") ||
          message.includes("dns")
        ) {
          errorMessage = "Server hostname not found. Please check the URL.";
        } else if (message.includes("timeout")) {
          errorMessage =
            "Connection timeout. Please check the URL and server status.";
        } else if (
          message.includes("certificate") ||
          message.includes("ssl") ||
          message.includes("tls")
        ) {
          errorMessage =
            "SSL/TLS certificate error. Please verify the server's certificate.";
        } else {
          errorMessage = `Connection failed: ${connectionError.message}`;
        }
      }

      return c.json({ error: errorMessage }, 400);
    }
  } catch (error) {
    console.error("Error creating server:", error);
    return c.json(
      {
        error: "Failed to create server",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/test/add-test-server", async (c) => {
  try {
    const boss = await getJobQueue();
    const jobId = await boss.send(JobTypes.ADD_SERVER, {
      name: "Test Jellyfin Server",
      url: "http://localhost:8096",
      apiKey: "test-api-key",
    });

    return c.json({
      success: true,
      jobId,
      message: "Test server addition job queued",
    });
  } catch (error) {
    console.error("Error queuing test server job:", error);
    return c.json({ error: "Failed to queue test job" }, 500);
  }
});

// Backfill Jellyfin server IDs for existing servers
app.post("/backfill-jellyfin-ids", async (c) => {
  try {
    const boss = await getJobQueue();
    const jobId = await boss.send(BACKFILL_JOB_NAMES.BACKFILL_JELLYFIN_IDS, {});

    return c.json({
      success: true,
      jobId,
      message: "Backfill Jellyfin IDs job queued successfully",
    });
  } catch (error) {
    console.error("Error queuing backfill jellyfin ids job:", error);
    return c.json({ error: "Failed to queue job" }, 500);
  }
});

export default app;

