import type { Job } from "pg-boss";
import type { QueueStats } from "pg-boss";
import { PgBoss } from "pg-boss";
import {
  addServerJob,
  backfillJellyfinIdsJob,
  BACKFILL_JOB_NAMES,
  generateItemEmbeddingsJob,
  geolocateActivitiesJob,
  calculateFingerprintsJob,
  backfillActivityLocationsJob,
  GEOLOCATION_JOB_NAMES,
  jellyfinFullSyncWorker,
  jellyfinUsersSyncWorker,
  jellyfinLibrariesSyncWorker,
  jellyfinItemsSyncWorker,
  jellyfinActivitiesSyncWorker,
  jellyfinRecentItemsSyncWorker,
  jellyfinRecentActivitiesSyncWorker,
  jellyfinPeopleSyncWorker,
  JELLYFIN_JOB_NAMES,
  inferWatchtimeJob,
  INFER_WATCHTIME_JOB_NAME,
} from "./workers";
import {
  securityFullSyncJob,
  SECURITY_SYNC_JOB_NAME,
} from "./security-sync-job";
import {
  schedulerMaintenanceWorker,
  SCHEDULER_MAINTENANCE_JOB_NAME,
} from "./scheduler-maintenance";
import { formatError } from "../utils/format-error";
import { shouldLog } from "../utils/log-throttle";

let bossInstance: PgBoss | null = null;

// Default queue options for all queues
const DEFAULT_QUEUE_OPTIONS = {
  retryLimit: 3,
  retryDelay: 30,
  retentionSeconds: 60 * 60 * 24, // 24 hours
  deleteAfterSeconds: 60 * 60 * 24 * 2, // 2 days
};

// Default worker options - relax idle poll backstop to 15s since useListenNotify wakes instantly
const DEFAULT_WORK_OPTIONS = {
  batchSize: 1,
  pollingIntervalSeconds: 15,
};

// Helper to extract first job from batch and call handler with proper typing
function firstJob<T, R>(handler: (job: Job<T>) => Promise<R>) {
  return async (jobs: Job<T>[]): Promise<R> => handler(jobs[0]);
}

export async function getJobQueue(): Promise<PgBoss> {
  if (bossInstance) {
    return bossInstance;
  }

  const connectionString = Bun.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const postgres = await import("postgres");
  const sql = postgres.default(connectionString);

  // Check if old v9 schema exists (has 'job' table without 'queue' table)
  const schemaCheck = await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'pgboss' AND table_name = 'job'
    ) as has_job,
    EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'pgboss' AND table_name = 'queue'
    ) as has_queue
  `;

  const hasOldSchema =
    schemaCheck[0]?.has_job === true && schemaCheck[0]?.has_queue === false;

  if (hasOldSchema) {
    console.warn(
      "[pg-boss] Incompatible v9 schema detected, dropping and recreating..."
    );
    await sql`DROP SCHEMA IF EXISTS pgboss CASCADE`;
    console.info("[pg-boss] Old schema dropped");
  }

  await sql.end();

  bossInstance = new PgBoss({
    connectionString,
    useListenNotify: true,
  });

  bossInstance.on("error", (error) => {
    if (shouldLog("pg-boss-instance-error", 30_000)) {
      console.error("[pg-boss] error:", formatError(error));
    }
  });

  await bossInstance.start();

  await createQueues(bossInstance);
  await registerJobHandlers(bossInstance);

  return bossInstance;
}

async function createQueues(boss: PgBoss) {
  // Create all queues with default options
  const queueNames = [
    "add-server",
    "generate-item-embeddings",
    JELLYFIN_JOB_NAMES.FULL_SYNC,
    JELLYFIN_JOB_NAMES.USERS_SYNC,
    JELLYFIN_JOB_NAMES.LIBRARIES_SYNC,
    JELLYFIN_JOB_NAMES.ITEMS_SYNC,
    JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC,
    JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC,
    JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC,
    JELLYFIN_JOB_NAMES.PEOPLE_SYNC,
    GEOLOCATION_JOB_NAMES.GEOLOCATE_ACTIVITIES,
    GEOLOCATION_JOB_NAMES.CALCULATE_FINGERPRINTS,
    GEOLOCATION_JOB_NAMES.BACKFILL_LOCATIONS,
    SECURITY_SYNC_JOB_NAME,
    BACKFILL_JOB_NAMES.BACKFILL_JELLYFIN_IDS,
    INFER_WATCHTIME_JOB_NAME,
    SCHEDULER_MAINTENANCE_JOB_NAME,
  ];

  for (const name of queueNames) {
    await boss.createQueue(name, DEFAULT_QUEUE_OPTIONS);
  }

  console.log(`[pg-boss] Created ${queueNames.length} job queues`);
}

async function registerJobHandlers(boss: PgBoss) {
  // Register media server job types
  await boss.work("add-server", DEFAULT_WORK_OPTIONS, firstJob(addServerJob));

  // Register item embeddings job
  await boss.work("generate-item-embeddings", DEFAULT_WORK_OPTIONS, firstJob(generateItemEmbeddingsJob));

  // Register Jellyfin sync workers
  await boss.work(JELLYFIN_JOB_NAMES.FULL_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinFullSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.USERS_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinUsersSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.LIBRARIES_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinLibrariesSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.ITEMS_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinItemsSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinActivitiesSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinRecentItemsSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinRecentActivitiesSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.PEOPLE_SYNC, DEFAULT_WORK_OPTIONS, firstJob(jellyfinPeopleSyncWorker));

  // Register geolocation jobs
  await boss.work(GEOLOCATION_JOB_NAMES.GEOLOCATE_ACTIVITIES, DEFAULT_WORK_OPTIONS, firstJob(geolocateActivitiesJob));
  await boss.work(GEOLOCATION_JOB_NAMES.CALCULATE_FINGERPRINTS, DEFAULT_WORK_OPTIONS, firstJob(calculateFingerprintsJob));
  await boss.work(GEOLOCATION_JOB_NAMES.BACKFILL_LOCATIONS, DEFAULT_WORK_OPTIONS, firstJob(backfillActivityLocationsJob));

  // Register security sync job
  await boss.work(SECURITY_SYNC_JOB_NAME, DEFAULT_WORK_OPTIONS, firstJob(securityFullSyncJob));

  // Register backfill jobs
  await boss.work(BACKFILL_JOB_NAMES.BACKFILL_JELLYFIN_IDS, DEFAULT_WORK_OPTIONS, firstJob(backfillJellyfinIdsJob));

  // Register infer watchtime job
  await boss.work(INFER_WATCHTIME_JOB_NAME, DEFAULT_WORK_OPTIONS, firstJob(inferWatchtimeJob));

  // Register scheduler maintenance job
  await boss.work(SCHEDULER_MAINTENANCE_JOB_NAME, DEFAULT_WORK_OPTIONS, firstJob(schedulerMaintenanceWorker));

  console.log("[pg-boss] All job handlers registered successfully");
}

export async function closeJobQueue(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
    bossInstance = null;
  }
}

// Job queue utilities
export const JobTypes = {
  ADD_SERVER: "add-server",
  GENERATE_ITEM_EMBEDDINGS: "generate-item-embeddings",
} as const;

/**
 * pg-boss 12.31+ returns a list of stat snapshots from getQueueStats (a history
 * when persistQueueStats is enabled), so callers need the most recent one.
 */
export function latestQueueStats(stats: QueueStats[]): QueueStats | undefined {
  return stats.reduce<QueueStats | undefined>(
    (newest, current) =>
      !newest || current.capturedOn > newest.capturedOn ? current : newest,
    undefined,
  );
}
