import express from "express";
import cors from "cors";
import helmet from "helmet";
import * as dotenv from "dotenv";
import { getJobQueue, closeJobQueue } from "./jobs/queue";
import { activityScheduler } from "./jobs/scheduler";
import { sessionPoller } from "./jobs/session-poller";
import { closeConnection } from "@streamystats/database";
import jobRoutes from "./routes/jobs";

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "localhost";

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(`Invalid PORT value: "${process.env.PORT}". Please provide a valid port number between 1 and 65535.`);
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/jobs", jobRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    scheduler: activityScheduler.getStatus(),
    sessionPoller: sessionPoller.getStatus(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Job Server API",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      jobs: "/api/jobs",
      queueStats: "/api/jobs/queue/stats",
      jobResults: "/api/jobs/results",
      serverStatus: "/api/jobs/server-status",
    },
  });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error("Error:", err);
    res.status(500).json({
      error: "Internal server error",
      message:
        process.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    });
  }
);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

async function startServer() {
  try {
    // Initialize job queue
    console.log("Initializing job queue...");
    await getJobQueue();

    // Start the sync scheduler
    console.log("Starting sync scheduler...");
    await activityScheduler.start();

    // Start the session poller
    console.log("Starting session poller...");
    await sessionPoller.start();

    // Start the server
    app.listen(PORT, HOST, () => {
      console.log(`🚀 Job server running on port ${PORT}`);
      console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
      console.log(`🔧 API docs: http://${HOST}:${PORT}/`);

      const status = activityScheduler.getStatus();
      console.log(
        `⏰ Activity sync scheduler is running (${status.activitySyncInterval})`
      );
      console.log(
        `📦 Recently added items sync scheduler is running (${status.recentItemsSyncInterval})`
      );
      console.log(`🎯 Session poller is running (every 5 seconds)`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Received SIGTERM, shutting down gracefully...");
  activityScheduler.stop();
  sessionPoller.stop();
  await closeJobQueue();
  await closeConnection();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Received SIGINT, shutting down gracefully...");
  activityScheduler.stop();
  sessionPoller.stop();
  await closeJobQueue();
  await closeConnection();
  process.exit(0);
});

// Start the server
startServer();
