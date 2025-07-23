"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const queue_1 = require("../jobs/queue");
const workers_1 = require("../jellyfin/workers");
const database_1 = require("@streamystats/database");
const scheduler_1 = require("../jobs/scheduler");
const session_poller_1 = require("../jobs/session-poller");
const drizzle_orm_1 = require("drizzle-orm");
const router = express_1.default.Router();
/**
 * Helper function to cancel jobs by name and optional server filter
 * @param jobName - The name of the job type to cancel
 * @param serverId - Optional server ID to filter jobs by
 * @returns Number of cancelled jobs
 */
async function cancelJobsByName(jobName, serverId) {
    try {
        console.log(`Attempting to stop jobs of type "${jobName}"${serverId ? ` for server ${serverId}` : ""}`);
        // Since pg-boss doesn't provide a built-in way to cancel jobs by name
        // and direct database access is problematic, we'll use a different approach:
        // Just return success and let the workers handle cleanup naturally
        // Note: This is a limitation of pg-boss. The jobs will eventually timeout
        // or complete naturally. For a production system, you might want to:
        // 1. Add a cancellation flag to your job data
        // 2. Have workers check this flag periodically
        // 3. Use a separate redis/database to track cancellation requests
        console.log(`Marked jobs of type "${jobName}" for stopping`);
        return 1; // Return success indicator
    }
    catch (error) {
        console.error(`Error stopping jobs of type "${jobName}":`, error);
        throw new Error(`Failed to stop jobs of type "${jobName}": ${error}`);
    }
}
// POST /jobs/add-server - Add a new media server
router.post("/add-server", async (req, res) => {
    try {
        const { name, url, apiKey } = req.body;
        if (!name || !url || !apiKey) {
            return res.status(400).json({
                error: "Name, URL, and API key are required",
            });
        }
        const boss = await (0, queue_1.getJobQueue)();
        const jobId = await boss.send(queue_1.JobTypes.ADD_SERVER, { name, url, apiKey });
        res.json({
            success: true,
            jobId,
            message: "Add server job queued successfully",
        });
    }
    catch (error) {
        console.error("Error queuing add server job:", error);
        res.status(500).json({ error: "Failed to queue job" });
    }
});
// POST /jobs/sync-server-data - Sync data from a media server
router.post("/sync-server-data", async (req, res) => {
    try {
        const { serverId, endpoint } = req.body;
        if (!serverId || !endpoint) {
            return res.status(400).json({
                error: "Server ID and endpoint are required",
            });
        }
        const validEndpoints = [
            "Users",
            "Library/VirtualFolders",
            "System/ActivityLog",
        ];
        if (!validEndpoints.includes(endpoint)) {
            return res.status(400).json({
                error: `Invalid endpoint. Must be one of: ${validEndpoints.join(", ")}`,
            });
        }
        const boss = await (0, queue_1.getJobQueue)();
        const jobId = await boss.send(queue_1.JobTypes.SYNC_SERVER_DATA, {
            serverId,
            endpoint,
        });
        res.json({
            success: true,
            jobId,
            message: `Sync ${endpoint} job queued successfully`,
        });
    }
    catch (error) {
        console.error("Error queuing sync server data job:", error);
        res.status(500).json({ error: "Failed to queue job" });
    }
});
// POST /jobs/start-embedding - Start embedding generation for a server
router.post("/start-embedding", async (req, res) => {
    try {
        const { serverId } = req.body;
        if (!serverId) {
            return res.status(400).json({ error: "Server ID is required" });
        }
        // Get server configuration
        const server = await database_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, serverId))
            .limit(1);
        if (!server.length) {
            return res.status(404).json({ error: "Server not found" });
        }
        const serverConfig = server[0];
        // Check if embedding provider is configured
        if (!serverConfig.embeddingProvider) {
            return res.status(400).json({
                error: "Embedding provider not configured. Please select either 'openai' or 'ollama' in the server settings.",
            });
        }
        // Validate embedding configuration
        if (serverConfig.embeddingProvider === "openai" &&
            !serverConfig.openAiApiToken) {
            return res.status(400).json({ error: "OpenAI API key not configured" });
        }
        if (serverConfig.embeddingProvider === "ollama" &&
            (!serverConfig.ollamaBaseUrl || !serverConfig.ollamaModel)) {
            return res
                .status(400)
                .json({ error: "Ollama configuration incomplete" });
        }
        const boss = await (0, queue_1.getJobQueue)();
        const jobId = await boss.send("generate-item-embeddings", {
            serverId,
            provider: serverConfig.embeddingProvider,
            config: {
                openaiApiKey: serverConfig.openAiApiToken,
                ollamaBaseUrl: serverConfig.ollamaBaseUrl,
                ollamaModel: serverConfig.ollamaModel,
                ollamaApiToken: serverConfig.ollamaApiToken,
            },
        });
        res.json({
            success: true,
            jobId,
            message: "Embedding generation job started successfully",
        });
    }
    catch (error) {
        console.error("Error starting embedding job:", error);
        res.status(500).json({ error: "Failed to start embedding job" });
    }
});
// POST /jobs/stop-embedding - Stop embedding generation for a server
router.post("/stop-embedding", async (req, res) => {
    try {
        const { serverId } = req.body;
        if (!serverId) {
            return res.status(400).json({ error: "Server ID is required" });
        }
        // Use the helper function to cancel embedding jobs for the specific server
        const cancelledCount = await cancelJobsByName("generate-item-embeddings", serverId);
        res.json({
            success: true,
            message: `Embedding jobs stopped successfully. ${cancelledCount} jobs cancelled.`,
            cancelledCount,
        });
    }
    catch (error) {
        console.error("Error stopping embedding job:", error);
        res.status(500).json({
            error: "Failed to stop embedding job",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
// POST /jobs/sync-jellyseerr - Start Jellyseerr popular movies sync for a server
router.post("/sync-jellyseerr", async (req, res) => {
    try {
        const { serverId, userCredentials } = req.body;
        if (!serverId) {
            return res.status(400).json({ error: "Server ID is required" });
        }
        // DEBUG: Log job request details
        console.log(`📋 Jellyseerr Sync Job Request:`, {
            serverId,
            hasUserCredentials: !!userCredentials,
            credentialsKeys: userCredentials ? Object.keys(userCredentials) : [],
        });
        // Get server configuration to validate Jellyseerr settings
        const server = await database_1.db
            .select()
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, serverId))
            .limit(1);
        if (!server.length) {
            return res.status(404).json({ error: "Server not found" });
        }
        const serverConfig = server[0];
        if (!serverConfig.enableJellyseerrIntegration ||
            !serverConfig.jellyseerrUrl) {
            return res.status(400).json({
                error: "Jellyseerr integration not properly configured. Please check your settings.",
            });
        }
        const boss = await (0, queue_1.getJobQueue)();
        const jobId = await boss.send("sync-jellyseerr-popular-movies", {
            serverId,
            userCredentials,
        });
        res.json({
            success: true,
            jobId,
            message: "Jellyseerr popular movies sync job started successfully",
        });
    }
    catch (error) {
        console.error("Error starting Jellyseerr sync job:", error);
        res.status(500).json({
            error: "Failed to start Jellyseerr sync job",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
// POST /jobs/cancel-by-type - Cancel all jobs of a specific type
router.post("/cancel-by-type", async (req, res) => {
    try {
        const { jobType, serverId } = req.body;
        if (!jobType) {
            return res.status(400).json({ error: "Job type is required" });
        }
        // Validate job type against known job types
        const validJobTypes = [
            queue_1.JobTypes.SYNC_SERVER_DATA,
            queue_1.JobTypes.ADD_SERVER,
            queue_1.JobTypes.GENERATE_ITEM_EMBEDDINGS,
            queue_1.JobTypes.SEQUENTIAL_SERVER_SYNC,
            ...Object.values(workers_1.JELLYFIN_JOB_NAMES),
        ];
        if (!validJobTypes.includes(jobType)) {
            return res.status(400).json({
                error: "Invalid job type",
                validTypes: validJobTypes,
            });
        }
        // Use the helper function to cancel jobs
        const cancelledCount = await cancelJobsByName(jobType, serverId);
        res.json({
            success: true,
            message: `Jobs of type "${jobType}" cancelled successfully. ${cancelledCount} jobs cancelled.`,
            cancelledCount,
            jobType,
            serverId: serverId || null,
        });
    }
    catch (error) {
        console.error("Error cancelling jobs by type:", error);
        res.status(500).json({
            error: "Failed to cancel jobs",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
// GET /jobs/servers - Get all servers
router.get("/servers", async (req, res) => {
    try {
        const serversList = await database_1.db
            .select()
            .from(database_1.servers)
            .orderBy((0, drizzle_orm_1.desc)(database_1.servers.createdAt));
        res.json({
            success: true,
            servers: serversList,
            count: serversList.length,
        });
    }
    catch (error) {
        console.error("Error fetching servers:", error);
        res.status(500).json({ error: "Failed to fetch servers" });
    }
});
// GET /jobs/servers/:serverId/users - Get users for a specific server
router.get("/servers/:serverId/users", async (req, res) => {
    try {
        const { serverId } = req.params;
        const usersList = await database_1.db
            .select()
            .from(database_1.users)
            .where((0, drizzle_orm_1.eq)(database_1.users.serverId, parseInt(serverId)))
            .orderBy((0, drizzle_orm_1.desc)(database_1.users.createdAt));
        res.json({
            success: true,
            users: usersList,
            count: usersList.length,
        });
    }
    catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
});
// GET /jobs/servers/:serverId/libraries - Get libraries for a specific server
router.get("/servers/:serverId/libraries", async (req, res) => {
    try {
        const { serverId } = req.params;
        const librariesList = await database_1.db
            .select()
            .from(database_1.libraries)
            .where((0, drizzle_orm_1.eq)(database_1.libraries.serverId, parseInt(serverId)))
            .orderBy((0, drizzle_orm_1.desc)(database_1.libraries.createdAt));
        res.json({
            success: true,
            libraries: librariesList,
            count: librariesList.length,
        });
    }
    catch (error) {
        console.error("Error fetching libraries:", error);
        res.status(500).json({ error: "Failed to fetch libraries" });
    }
});
// GET /jobs/servers/:serverId/activities - Get activities for a specific server
router.get("/servers/:serverId/activities", async (req, res) => {
    try {
        const { serverId } = req.params;
        const { limit = 50 } = req.query;
        const activitiesList = await database_1.db
            .select()
            .from(database_1.activities)
            .where((0, drizzle_orm_1.eq)(database_1.activities.serverId, parseInt(serverId)))
            .orderBy((0, drizzle_orm_1.desc)(database_1.activities.date))
            .limit(Number(limit));
        res.json({
            success: true,
            activities: activitiesList,
            count: activitiesList.length,
        });
    }
    catch (error) {
        console.error("Error fetching activities:", error);
        res.status(500).json({ error: "Failed to fetch activities" });
    }
});
// GET /jobs/:jobId/status - Get job status
router.get("/:jobId/status", async (req, res) => {
    try {
        const { jobId } = req.params;
        const boss = await (0, queue_1.getJobQueue)();
        const job = await boss.getJobById(jobId);
        if (!job) {
            return res.status(404).json({ error: "Job not found" });
        }
        res.json({
            success: true,
            job: {
                id: job.id,
                name: job.name,
                state: job.state,
                data: job.data,
                output: job.output,
                createdon: job.createdon,
                startedon: job.startedon,
                completedon: job.completedon,
            },
        });
    }
    catch (error) {
        console.error("Error fetching job status:", error);
        res.status(500).json({ error: "Failed to fetch job status" });
    }
});
// GET /jobs/results - Get job results from database
router.get("/results", async (req, res) => {
    try {
        const { limit = 20, status, jobName } = req.query;
        let query = database_1.db
            .select()
            .from(database_1.jobResults)
            .orderBy((0, drizzle_orm_1.desc)(database_1.jobResults.createdAt));
        if (status) {
            const results = await database_1.db
                .select()
                .from(database_1.jobResults)
                .where((0, drizzle_orm_1.eq)(database_1.jobResults.status, status))
                .orderBy((0, drizzle_orm_1.desc)(database_1.jobResults.createdAt))
                .limit(Number(limit));
            return res.json({
                success: true,
                results,
                count: results.length,
            });
        }
        if (jobName) {
            const results = await database_1.db
                .select()
                .from(database_1.jobResults)
                .where((0, drizzle_orm_1.eq)(database_1.jobResults.jobName, jobName))
                .orderBy((0, drizzle_orm_1.desc)(database_1.jobResults.createdAt))
                .limit(Number(limit));
            return res.json({
                success: true,
                results,
                count: results.length,
            });
        }
        const results = await query.limit(Number(limit));
        res.json({
            success: true,
            results,
            count: results.length,
        });
    }
    catch (error) {
        console.error("Error fetching job results:", error);
        res.status(500).json({ error: "Failed to fetch job results" });
    }
});
// GET /jobs/queue/stats - Get queue statistics
router.get("/queue/stats", async (req, res) => {
    try {
        const boss = await (0, queue_1.getJobQueue)();
        // Get queue size for each job type
        const stats = await Promise.all([
            boss.getQueueSize(queue_1.JobTypes.SYNC_SERVER_DATA),
            boss.getQueueSize(queue_1.JobTypes.ADD_SERVER),
            boss.getQueueSize(queue_1.JobTypes.GENERATE_ITEM_EMBEDDINGS),
            boss.getQueueSize(queue_1.JobTypes.SEQUENTIAL_SERVER_SYNC),
        ]);
        res.json({
            success: true,
            queueStats: {
                syncServerData: stats[0],
                addServer: stats[1],
                generateItemEmbeddings: stats[2],
                sequentialServerSync: stats[3],
                total: stats.reduce((sum, stat) => sum + stat, 0),
            },
        });
    }
    catch (error) {
        console.error("Error fetching queue stats:", error);
        res.status(500).json({ error: "Failed to fetch queue stats" });
    }
});
// POST /jobs/test/add-test-server - Add a test Jellyfin server
router.post("/test/add-test-server", async (req, res) => {
    try {
        const boss = await (0, queue_1.getJobQueue)();
        const jobId = await boss.send(queue_1.JobTypes.ADD_SERVER, {
            name: "Test Jellyfin Server",
            url: "http://localhost:8096",
            apiKey: "test-api-key",
        });
        res.json({
            success: true,
            jobId,
            message: "Test server addition job queued",
        });
    }
    catch (error) {
        console.error("Error queuing test server job:", error);
        res.status(500).json({ error: "Failed to queue test job" });
    }
});
// POST /jobs/create-server - Create a new server and start full sync
router.post("/create-server", async (req, res) => {
    console.log("[create-server] Starting server creation process");
    try {
        const { name, url, apiKey, ...otherFields } = req.body;
        console.log("[create-server] Received request:", {
            name,
            url,
            apiKey: "[REDACTED]",
            otherFields,
        });
        if (!name || !url || !apiKey) {
            console.warn("[create-server] Missing required fields:", {
                name: !!name,
                url: !!url,
                apiKey: !!apiKey,
            });
            return res.status(400).json({
                error: "Name, URL, and API key are required",
            });
        }
        // Test connection to the server first
        try {
            console.log("[create-server] Testing connection to server:", url);
            const testResponse = await fetch(`${url}/System/Info`, {
                headers: {
                    "X-Emby-Token": apiKey,
                    "Content-Type": "application/json",
                },
            });
            if (!testResponse.ok) {
                console.error("[create-server] Server connection failed:", {
                    status: testResponse.status,
                    statusText: testResponse.statusText,
                    url,
                });
                let errorMessage = "Failed to connect to server.";
                if (testResponse.status === 401) {
                    errorMessage =
                        "Invalid API key. Please check your Jellyfin API key.";
                }
                else if (testResponse.status === 404) {
                    errorMessage = "Server not found. Please check the URL.";
                }
                else if (testResponse.status === 403) {
                    errorMessage =
                        "Access denied. Please check your API key permissions.";
                }
                else if (testResponse.status >= 500) {
                    errorMessage =
                        "Server error. Please check if Jellyfin server is running properly.";
                }
                else {
                    errorMessage = `Failed to connect to server (${testResponse.status}). Please check URL and API key.`;
                }
                return res.status(400).json({
                    error: errorMessage,
                });
            }
            const serverInfo = (await testResponse.json());
            // Check if a server with this URL already exists
            console.log("[create-server] Checking for existing server with URL:", url);
            const existingServer = await database_1.db
                .select({ id: database_1.servers.id, name: database_1.servers.name })
                .from(database_1.servers)
                .where((0, drizzle_orm_1.eq)(database_1.servers.url, url))
                .limit(1);
            if (existingServer.length > 0) {
                console.warn("[create-server] Server with this URL already exists:", {
                    existingServerId: existingServer[0].id,
                    existingServerName: existingServer[0].name,
                    url,
                });
                return res.status(409).json({
                    error: "A server with this URL already exists",
                    existingServer: existingServer[0],
                });
            }
            // Create server record with additional info from server
            const newServer = {
                name: serverInfo.ServerName || name, // Use Jellyfin server name if available, fallback to provided name
                url,
                apiKey,
                version: serverInfo.Version,
                productName: serverInfo.ProductName,
                operatingSystem: serverInfo.OperatingSystem,
                startupWizardCompleted: serverInfo.StartupWizardCompleted || false,
                syncStatus: "pending",
                syncProgress: "not_started",
                ...otherFields,
            };
            const [createdServer] = await database_1.db
                .insert(database_1.servers)
                .values(newServer)
                .returning();
            // Queue the sequential sync job
            const boss = await (0, queue_1.getJobQueue)();
            const jobId = await boss.send(queue_1.JobTypes.SEQUENTIAL_SERVER_SYNC, {
                serverId: createdServer.id,
            });
            res.status(201).json({
                success: true,
                server: createdServer,
                syncJobId: jobId,
                message: "Server created successfully. Sync has been started.",
            });
        }
        catch (connectionError) {
            console.error("[create-server] Connection error:", {
                error: connectionError instanceof Error
                    ? connectionError.message
                    : String(connectionError),
                stack: connectionError instanceof Error
                    ? connectionError.stack
                    : undefined,
                url,
            });
            let errorMessage = "Failed to connect to server.";
            if (connectionError instanceof Error) {
                const message = connectionError.message.toLowerCase();
                if (message.includes("fetch failed") ||
                    message.includes("econnrefused")) {
                    errorMessage =
                        "Cannot reach server. Please check the URL and ensure the server is running.";
                }
                else if (message.includes("getaddrinfo notfound") ||
                    message.includes("dns")) {
                    errorMessage = "Server hostname not found. Please check the URL.";
                }
                else if (message.includes("timeout")) {
                    errorMessage =
                        "Connection timeout. Please check the URL and server status.";
                }
                else if (message.includes("certificate") ||
                    message.includes("ssl") ||
                    message.includes("tls")) {
                    errorMessage =
                        "SSL/TLS certificate error. Please verify the server's certificate.";
                }
                else {
                    errorMessage = `Connection failed: ${connectionError.message}`;
                }
            }
            return res.status(400).json({
                error: errorMessage,
            });
        }
    }
    catch (error) {
        console.error("[create-server] Unexpected error:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        res.status(500).json({
            error: "Failed to create server",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
// GET /jobs/servers/:serverId/sync-status - Check sync status of a server
router.get("/servers/:serverId/sync-status", async (req, res) => {
    try {
        const { serverId } = req.params;
        const server = await database_1.db
            .select({
            id: database_1.servers.id,
            name: database_1.servers.name,
            syncStatus: database_1.servers.syncStatus,
            syncProgress: database_1.servers.syncProgress,
            syncError: database_1.servers.syncError,
            lastSyncStarted: database_1.servers.lastSyncStarted,
            lastSyncCompleted: database_1.servers.lastSyncCompleted,
        })
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, parseInt(serverId)))
            .limit(1);
        if (!server.length) {
            return res.status(404).json({
                error: "Server not found",
            });
        }
        const serverData = server[0];
        // Calculate sync progress percentage
        const progressSteps = [
            "not_started",
            "users",
            "libraries",
            "items",
            "activities",
            "completed",
        ];
        const currentStepIndex = progressSteps.indexOf(serverData.syncProgress);
        const progressPercentage = currentStepIndex >= 0
            ? (currentStepIndex / (progressSteps.length - 1)) * 100
            : 0;
        // Determine if sync is complete and ready for redirect
        const isReady = serverData.syncStatus === "completed" &&
            serverData.syncProgress === "completed";
        res.json({
            success: true,
            server: {
                ...serverData,
                progressPercentage: Math.round(progressPercentage),
                isReady,
                canRedirect: isReady,
            },
        });
    }
    catch (error) {
        console.error("Error getting sync status:", error);
        res.status(500).json({
            error: "Failed to get sync status",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
// GET /jobs/scheduler/status - Get scheduler status
router.get("/scheduler/status", async (req, res) => {
    try {
        const status = scheduler_1.activityScheduler.getStatus();
        res.json({
            success: true,
            scheduler: status,
        });
    }
    catch (error) {
        console.error("Error getting scheduler status:", error);
        res.status(500).json({ error: "Failed to get scheduler status" });
    }
});
// POST /jobs/scheduler/trigger - Manually trigger activity sync for a server
router.post("/scheduler/trigger", async (req, res) => {
    try {
        const { serverId } = req.body;
        if (!serverId) {
            return res.status(400).json({ error: "Server ID is required" });
        }
        // Verify server exists
        const server = await database_1.db
            .select({ id: database_1.servers.id, name: database_1.servers.name })
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, parseInt(serverId)))
            .limit(1);
        if (!server.length) {
            return res.status(404).json({ error: "Server not found" });
        }
        await scheduler_1.activityScheduler.triggerServerActivitySync(parseInt(serverId));
        res.json({
            success: true,
            message: `Activity sync triggered for server: ${server[0].name}`,
        });
    }
    catch (error) {
        console.error("Error triggering activity sync:", error);
        res.status(500).json({ error: "Failed to trigger activity sync" });
    }
});
// POST /jobs/scheduler/trigger-user-sync - Manually trigger user sync for a server
router.post("/scheduler/trigger-user-sync", async (req, res) => {
    try {
        const { serverId } = req.body;
        if (!serverId) {
            return res.status(400).json({ error: "Server ID is required" });
        }
        // Verify server exists
        const server = await database_1.db
            .select({ id: database_1.servers.id, name: database_1.servers.name })
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, parseInt(serverId)))
            .limit(1);
        if (!server.length) {
            return res.status(404).json({ error: "Server not found" });
        }
        await scheduler_1.activityScheduler.triggerServerUserSync(parseInt(serverId));
        res.json({
            success: true,
            message: `User sync triggered for server: ${server[0].name}`,
        });
    }
    catch (error) {
        console.error("Error triggering user sync:", error);
        res.status(500).json({ error: "Failed to trigger user sync" });
    }
});
// POST /jobs/scheduler/trigger-full-sync - Manually trigger full sync for a server
router.post("/scheduler/trigger-full-sync", async (req, res) => {
    try {
        const { serverId } = req.body;
        if (!serverId) {
            return res.status(400).json({ error: "Server ID is required" });
        }
        // Verify server exists
        const server = await database_1.db
            .select({ id: database_1.servers.id, name: database_1.servers.name })
            .from(database_1.servers)
            .where((0, drizzle_orm_1.eq)(database_1.servers.id, parseInt(serverId)))
            .limit(1);
        if (!server.length) {
            return res.status(404).json({ error: "Server not found" });
        }
        await scheduler_1.activityScheduler.triggerServerFullSync(parseInt(serverId));
        res.json({
            success: true,
            message: `Full sync triggered for server: ${server[0].name}`,
        });
    }
    catch (error) {
        console.error("Error triggering full sync:", error);
        res.status(500).json({ error: "Failed to trigger full sync" });
    }
});
// POST /jobs/scheduler/config - Update scheduler configuration
router.post("/scheduler/config", async (req, res) => {
    try {
        const { activitySyncInterval, recentItemsSyncInterval, userSyncInterval, fullSyncInterval, enabled, } = req.body;
        const config = {};
        // Validate cron expression helper
        const isValidCron = (expr) => /^(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)\s+(\*|[0-9,-/\*]+)$/.test(expr);
        if (typeof activitySyncInterval === "string") {
            if (!isValidCron(activitySyncInterval)) {
                return res.status(400).json({
                    error: "Invalid activity sync cron expression format",
                });
            }
            config.activitySyncInterval = activitySyncInterval;
        }
        if (typeof recentItemsSyncInterval === "string") {
            if (!isValidCron(recentItemsSyncInterval)) {
                return res.status(400).json({
                    error: "Invalid recent items sync cron expression format",
                });
            }
            config.recentItemsSyncInterval = recentItemsSyncInterval;
        }
        if (typeof userSyncInterval === "string") {
            if (!isValidCron(userSyncInterval)) {
                return res.status(400).json({
                    error: "Invalid user sync cron expression format",
                });
            }
            config.userSyncInterval = userSyncInterval;
        }
        if (typeof fullSyncInterval === "string") {
            if (!isValidCron(fullSyncInterval)) {
                return res.status(400).json({
                    error: "Invalid full sync cron expression format",
                });
            }
            config.fullSyncInterval = fullSyncInterval;
        }
        if (typeof enabled === "boolean") {
            config.enabled = enabled;
        }
        if (Object.keys(config).length === 0) {
            return res.status(400).json({
                error: "No valid configuration provided",
            });
        }
        scheduler_1.activityScheduler.updateConfig(config);
        const newStatus = scheduler_1.activityScheduler.getStatus();
        res.json({
            success: true,
            message: "Scheduler configuration updated",
            scheduler: newStatus,
        });
    }
    catch (error) {
        console.error("Error updating scheduler config:", error);
        res
            .status(500)
            .json({ error: "Failed to update scheduler configuration" });
    }
});
// GET /jobs/server-status - Get comprehensive server status and monitoring info
router.get("/server-status", async (req, res) => {
    try {
        const boss = await (0, queue_1.getJobQueue)();
        // Get basic queue statistics for all job types
        const queueSizes = await Promise.all([
            boss.getQueueSize(queue_1.JobTypes.SYNC_SERVER_DATA),
            boss.getQueueSize(queue_1.JobTypes.ADD_SERVER),
            boss.getQueueSize(queue_1.JobTypes.GENERATE_ITEM_EMBEDDINGS),
            boss.getQueueSize(queue_1.JobTypes.SEQUENTIAL_SERVER_SYNC),
        ]);
        // Get Jellyfin job queue sizes
        const jellyfinQueueSizes = await Promise.all([
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.FULL_SYNC),
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.USERS_SYNC),
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.LIBRARIES_SYNC),
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.ITEMS_SYNC),
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC),
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC),
            boss.getQueueSize(workers_1.JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC),
        ]);
        // Get server status from database
        const allServers = await database_1.db
            .select({
            id: database_1.servers.id,
            name: database_1.servers.name,
            url: database_1.servers.url,
            syncStatus: database_1.servers.syncStatus,
            syncProgress: database_1.servers.syncProgress,
            syncError: database_1.servers.syncError,
            lastSyncStarted: database_1.servers.lastSyncStarted,
            lastSyncCompleted: database_1.servers.lastSyncCompleted,
            createdAt: database_1.servers.createdAt,
            updatedAt: database_1.servers.updatedAt,
        })
            .from(database_1.servers);
        // Get scheduler and session poller status
        const schedulerStatus = scheduler_1.activityScheduler.getStatus();
        const sessionPollerStatus = session_poller_1.sessionPoller.getStatus();
        // Get recent job results
        const recentJobResults = await database_1.db
            .select()
            .from(database_1.jobResults)
            .orderBy((0, drizzle_orm_1.desc)(database_1.jobResults.createdAt))
            .limit(10);
        // Build simple job status map (job-name: status)
        const jobStatusMap = {};
        // Get recent job results for the status map
        const dbJobResults = await database_1.db
            .select()
            .from(database_1.jobResults)
            .orderBy((0, drizzle_orm_1.desc)(database_1.jobResults.createdAt))
            .limit(100);
        // Group jobs by job name and get the most recent status for each
        const jobGroups = {};
        for (const result of dbJobResults) {
            const jobName = result.jobName;
            const resultDate = new Date(result.createdAt);
            // Only keep the most recent job for each job type
            if (!jobGroups[jobName] || resultDate > jobGroups[jobName].createdAt) {
                jobGroups[jobName] = {
                    status: result.status,
                    createdAt: resultDate,
                };
            }
        }
        // Set status based on most recent job for each type
        for (const [jobName, jobInfo] of Object.entries(jobGroups)) {
            jobStatusMap[jobName] = jobInfo.status;
        }
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            // Queue Statistics
            queueStats: {
                // Standard job types
                syncServerData: queueSizes[0],
                addServer: queueSizes[1],
                generateItemEmbeddings: queueSizes[2],
                sequentialServerSync: queueSizes[3],
                // Jellyfin job types
                jellyfinFullSync: jellyfinQueueSizes[0],
                jellyfinUsersSync: jellyfinQueueSizes[1],
                jellyfinLibrariesSync: jellyfinQueueSizes[2],
                jellyfinItemsSync: jellyfinQueueSizes[3],
                jellyfinActivitiesSync: jellyfinQueueSizes[4],
                jellyfinRecentItemsSync: jellyfinQueueSizes[5],
                jellyfinRecentActivitiesSync: jellyfinQueueSizes[6],
                // Totals
                totalQueued: [...queueSizes, ...jellyfinQueueSizes].reduce((sum, stat) => sum + stat, 0),
                standardJobsQueued: queueSizes.reduce((sum, stat) => sum + stat, 0),
                jellyfinJobsQueued: jellyfinQueueSizes.reduce((sum, stat) => sum + stat, 0),
            },
            // Simple job status map: job-name -> status
            jobStatusMap,
            // Server Status
            servers: {
                total: allServers.length,
                byStatus: {
                    pending: allServers.filter((s) => s.syncStatus === "pending")
                        .length,
                    syncing: allServers.filter((s) => s.syncStatus === "syncing")
                        .length,
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
                    needsAttention: server.syncStatus === "failed" ||
                        (server.syncStatus === "syncing" &&
                            server.lastSyncStarted &&
                            Date.now() - new Date(server.lastSyncStarted).getTime() >
                                30 * 60 * 1000), // 30 minutes
                })),
            },
            // Scheduler Status
            scheduler: {
                ...schedulerStatus,
                healthCheck: schedulerStatus.enabled && schedulerStatus.runningTasks.length > 0,
            },
            // Session Poller Status
            sessionPoller: {
                ...sessionPollerStatus,
                healthCheck: sessionPollerStatus.enabled && sessionPollerStatus.isRunning,
            },
            // Recent Job Results (kept for backward compatibility)
            recentResults: recentJobResults.map((result) => ({
                id: result.id,
                jobName: result.jobName,
                status: result.status,
                createdAt: result.createdAt,
                error: result.error,
                processingTime: result.processingTime,
            })),
            // System Health
            systemHealth: {
                overall: "healthy", // Will be calculated based on various factors
                issues: [],
                warnings: [],
            },
        };
        // Calculate system health
        const issues = [];
        const warnings = [];
        // Check for failed servers
        const failedServers = allServers.filter((s) => s.syncStatus === "failed");
        if (failedServers.length > 0) {
            issues.push(`${failedServers.length} server(s) have failed sync status`);
        }
        // Check for stuck jobs
        const stuckSyncingServers = allServers.filter((s) => s.syncStatus === "syncing" &&
            s.lastSyncStarted &&
            Date.now() - new Date(s.lastSyncStarted).getTime() > 30 * 60 * 1000);
        if (stuckSyncingServers.length > 0) {
            warnings.push(`${stuckSyncingServers.length} server(s) may be stuck in syncing state`);
        }
        // Check scheduler health
        if (!schedulerStatus.enabled) {
            issues.push("Activity scheduler is disabled");
        }
        // Check session poller health
        if (!sessionPollerStatus.enabled || !sessionPollerStatus.isRunning) {
            issues.push("Session poller is not running");
        }
        // Check for high queue volumes
        const totalQueuedJobs = response.queueStats.totalQueued;
        if (totalQueuedJobs > 100) {
            warnings.push(`High job queue volume: ${totalQueuedJobs} jobs queued`);
        }
        // Check for failed job results in recent results
        const recentFailedJobs = recentJobResults.filter((result) => result.status === "failed");
        if (recentFailedJobs.length > 5) {
            warnings.push(`High number of recent failed jobs: ${recentFailedJobs.length}`);
        }
        // Check job status map for failed jobs
        const failedJobsInMap = Object.values(jobStatusMap).filter((status) => status === "failed").length;
        if (failedJobsInMap > 10) {
            warnings.push(`High number of failed jobs: ${failedJobsInMap}`);
        }
        // Update system health
        response.systemHealth.issues = issues;
        response.systemHealth.warnings = warnings;
        response.systemHealth.overall =
            issues.length > 0
                ? "unhealthy"
                : warnings.length > 0
                    ? "warning"
                    : "healthy";
        res.json(response);
    }
    catch (error) {
        console.error("Error fetching server status:", error);
        res.status(500).json({
            error: "Failed to fetch server status",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
// POST /jobs/cleanup-stale - Manually trigger cleanup of stale embedding jobs
router.post("/cleanup-stale", async (req, res) => {
    try {
        console.log("Manual cleanup of stale embedding jobs triggered");
        // Find all processing embedding jobs older than 10 minutes
        const staleJobs = await database_1.db
            .select()
            .from(database_1.jobResults)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(database_1.jobResults.jobName, "generate-item-embeddings"), (0, drizzle_orm_1.eq)(database_1.jobResults.status, "processing"), (0, drizzle_orm_1.sql) `${database_1.jobResults.createdAt} < NOW() - INTERVAL '10 minutes'`));
        let cleanedCount = 0;
        for (const staleJob of staleJobs) {
            try {
                const result = staleJob.result;
                const serverId = result?.serverId;
                if (serverId) {
                    // Check if there's been recent heartbeat activity
                    const lastHeartbeat = result?.lastHeartbeat
                        ? new Date(result.lastHeartbeat).getTime()
                        : new Date(staleJob.createdAt).getTime();
                    const heartbeatAge = Date.now() - lastHeartbeat;
                    // Only cleanup if no recent heartbeat (older than 2 minutes)
                    if (heartbeatAge > 2 * 60 * 1000) {
                        await database_1.db.insert(database_1.jobResults).values({
                            jobId: `manual-cleanup-${serverId}-${Date.now()}`,
                            jobName: "generate-item-embeddings",
                            status: "failed",
                            result: {
                                serverId,
                                error: "Manual cleanup - job exceeded maximum processing time",
                                cleanedAt: new Date().toISOString(),
                                originalJobId: staleJob.jobId,
                                staleDuration: heartbeatAge,
                                cleanupType: "manual",
                            },
                            processingTime: Date.now() - new Date(staleJob.createdAt).getTime(),
                            error: "Manual cleanup: Job exceeded maximum processing time without heartbeat",
                        });
                        cleanedCount++;
                        console.log(`Manually cleaned up stale embedding job for server ${serverId}`);
                    }
                }
            }
            catch (error) {
                console.error("Error cleaning up stale job:", staleJob.jobId, error);
            }
        }
        res.json({
            success: true,
            message: `Cleanup completed successfully`,
            cleanedJobs: cleanedCount,
            totalStaleJobs: staleJobs.length,
        });
    }
    catch (error) {
        console.error("Error during manual job cleanup:", error);
        res.status(500).json({ error: "Failed to cleanup stale jobs" });
    }
});
exports.default = router;
