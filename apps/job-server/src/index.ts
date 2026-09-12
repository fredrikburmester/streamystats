import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { getJobQueue, closeJobQueue } from "./jobs/queue";
import { activityScheduler } from "./jobs/scheduler";
import { sessionPoller } from "./jobs/session-poller";
import { db, closeConnection } from "@streamystats/database";
import { sql } from "drizzle-orm";
import { shouldLog } from "./utils/log-throttle";
import jobRoutes from "./routes/jobs/index";
import locationRoutes from "./routes/locations";
import eventsRoutes from "./routes/events-sse";

process.on("warning", (warning) => {
  if (warning?.name === "TimeoutNegativeWarning") return;
  console.warn(warning);
});

// Handle unhandled promise rejections to prevent silent failures
process.on("unhandledRejection", (reason, promise) => {
  console.error("[job-server] unhandledRejection:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  if (shouldLog("uncaught-exception", 5000)) {
    console.error("[job-server] uncaughtException:", error);
  }
  // Don't exit - try to keep the server running for session tracking
});

const app = new Hono();

const PORT = Number.parseInt(Bun.env.PORT || "3000", 10);
const HOST = Bun.env.HOST || "localhost";

if (Number.isNaN(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error(
    `Invalid PORT value: "${Bun.env.PORT}". Please provide a valid port number between 1 and 65535.`
  );
}

app.use("*", secureHeaders());
app.use("*", cors());

app.route("/api/jobs", jobRoutes);
app.route("/api", locationRoutes);
app.route("/api", eventsRoutes);

async function checkDatabaseHealth(
  timeoutMs = 2000
): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const start = Date.now();
  try {
    const queryPromise = db.execute(sql`SELECT 1`);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Database health check timed out")),
        timeoutMs
      )
    );
    await Promise.race([queryPromise, timeoutPromise]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

app.get("/health/live", (c) => {
  return c.json({ status: "alive", uptime: process.uptime() });
});

app.get("/health", async (c) => {
  const dbHealth = await checkDatabaseHealth();
  const sessionStatus = sessionPoller.getStatus();
  const isHealthy = dbHealth.ok && sessionStatus.healthy;

  return c.json(
    {
      status: isHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: {
        status: dbHealth.ok ? "connected" : "disconnected",
        latencyMs: dbHealth.latencyMs,
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
      scheduler: activityScheduler.getStatus(),
      sessionPoller: sessionStatus,
    },
    isHealthy ? 200 : 503
  );
});

app.get("/", (c) => {
  return c.json({
    message: "Job Server API",
    version: "2.0.0",
    runtime: "bun",
    endpoints: {
      health: "/health",
      jobs: "/api/jobs",
      queueStats: "/api/jobs/queue/stats",
      jobResults: "/api/jobs/results",
      serverStatus: "/api/jobs/server-status",
    },
  });
});

app.notFound((c) => {
  return c.json({ error: "Route not found" }, 404);
});

app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      error: "Internal server error",
      message:
        Bun.env.NODE_ENV === "development"
          ? err.message
          : "Something went wrong",
    },
    500
  );
});

async function startServer() {
  try {
    console.log("[job-server] phase=init step=job-queue");
    await getJobQueue();

    console.log("[job-server] phase=init step=scheduler");
    await activityScheduler.start();

    console.log("[job-server] phase=init step=session-poller");
    await sessionPoller.start();

    const server = Bun.serve({
      port: PORT,
      hostname: HOST,
      fetch: app.fetch,
      idleTimeout: 255, // Max value, for SSE connections
    });

    console.log(
      `[job-server] status=running host=${server.hostname} port=${server.port}`
    );
    console.log("[scheduler] started=session-poller interval=5s");
  } catch (error) {
    console.error("[job-server] status=start-failed", error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log("[job-server] status=shutting-down");
  activityScheduler.stop();
  await sessionPoller.stop();
  await closeJobQueue();
  await closeConnection();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startServer();
