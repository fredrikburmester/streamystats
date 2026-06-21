import type { Job } from "pg-boss";
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
import {
  calculateUserEmbeddingsJob,
  USER_EMBEDDING_JOB_NAME,
} from "./user-embedding-job";

let bossInstance: PgBoss | null = null;

// Default queue options for all queues
const DEFAULT_QUEUE_OPTIONS = {
  retryLimit: 3,
  retryDelay: 30,
  retentionSeconds: 60 * 60 * 24, // 24 hours
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
    USER_EMBEDDING_JOB_NAME,
  ];

  for (const name of queueNames) {
    await boss.createQueue(name, DEFAULT_QUEUE_OPTIONS);
  }

  console.log(`[pg-boss] Created ${queueNames.length} job queues`);
}

async function registerJobHandlers(boss: PgBoss) {
  // Register media server job types
  await boss.work("add-server", { batchSize: 1 }, firstJob(addServerJob));

  // Register item embeddings job
  await boss.work("generate-item-embeddings", { batchSize: 1 }, firstJob(generateItemEmbeddingsJob));

  // Register Jellyfin sync workers
  await boss.work(JELLYFIN_JOB_NAMES.FULL_SYNC, { batchSize: 1 }, firstJob(jellyfinFullSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.USERS_SYNC, { batchSize: 1 }, firstJob(jellyfinUsersSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.LIBRARIES_SYNC, { batchSize: 1 }, firstJob(jellyfinLibrariesSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.ITEMS_SYNC, { batchSize: 1 }, firstJob(jellyfinItemsSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC, { batchSize: 1 }, firstJob(jellyfinActivitiesSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC, { batchSize: 1 }, firstJob(jellyfinRecentItemsSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC, { batchSize: 1 }, firstJob(jellyfinRecentActivitiesSyncWorker));
  await boss.work(JELLYFIN_JOB_NAMES.PEOPLE_SYNC, { batchSize: 1 }, firstJob(jellyfinPeopleSyncWorker));

  // Register geolocation jobs
  await boss.work(GEOLOCATION_JOB_NAMES.GEOLOCATE_ACTIVITIES, { batchSize: 1 }, firstJob(geolocateActivitiesJob));
  await boss.work(GEOLOCATION_JOB_NAMES.CALCULATE_FINGERPRINTS, { batchSize: 1 }, firstJob(calculateFingerprintsJob));
  await boss.work(GEOLOCATION_JOB_NAMES.BACKFILL_LOCATIONS, { batchSize: 1 }, firstJob(backfillActivityLocationsJob));

  // Register security sync job
  await boss.work(SECURITY_SYNC_JOB_NAME, { batchSize: 1 }, firstJob(securityFullSyncJob));

  // Register backfill jobs
  await boss.work(BACKFILL_JOB_NAMES.BACKFILL_JELLYFIN_IDS, { batchSize: 1 }, firstJob(backfillJellyfinIdsJob));

  // Register infer watchtime job
  await boss.work(INFER_WATCHTIME_JOB_NAME, { batchSize: 1 }, firstJob(inferWatchtimeJob));

  // Register scheduler maintenance job
  await boss.work(SCHEDULER_MAINTENANCE_JOB_NAME, { batchSize: 1 }, firstJob(schedulerMaintenanceWorker));

  // Register user embeddings job
  await boss.work(USER_EMBEDDING_JOB_NAME, { batchSize: 1 }, firstJob(calculateUserEmbeddingsJob));

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
