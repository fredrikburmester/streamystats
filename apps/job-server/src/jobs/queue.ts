import PgBoss from "pg-boss";
import * as dotenv from "dotenv";
import {
  syncServerDataJob,
  addServerJob,
  sequentialServerSyncJob,
  // Import Jellyfin sync workers
  jellyfinFullSyncWorker,
  jellyfinUsersSyncWorker,
  jellyfinLibrariesSyncWorker,
  jellyfinItemsSyncWorker,
  jellyfinActivitiesSyncWorker,
  jellyfinRecentItemsSyncWorker,
  jellyfinRecentActivitiesSyncWorker,
  JELLYFIN_JOB_NAMES,
} from "./workers";
import { processHistoricalSessionsJob } from "./historical-sessions";

dotenv.config();

let bossInstance: PgBoss | null = null;

export async function getJobQueue(): Promise<PgBoss> {
  if (bossInstance) {
    return bossInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  bossInstance = new PgBoss({
    connectionString,
    retryLimit: 3,
    retryDelay: 30000, // 30 seconds
    onComplete: true,
    deleteAfterHours: 24, // Clean up completed jobs after 24 hours
    archiveCompletedAfterSeconds: 60 * 60 * 24, // Archive completed jobs after 24 hours
  });

  await bossInstance.start();
  await registerJobHandlers(bossInstance);

  return bossInstance;
}

async function registerJobHandlers(boss: PgBoss) {
  // Register media server job types
  await boss.work(
    "sync-server-data",
    { teamSize: 2, teamConcurrency: 1 }, // Limited concurrency for API rate limiting
    syncServerDataJob
  );
  await boss.work(
    "add-server",
    { teamSize: 1, teamConcurrency: 1 },
    addServerJob
  );


  // Register new sequential server sync job type
  await boss.work(
    "sequential-server-sync",
    { teamSize: 1, teamConcurrency: 1 },
    sequentialServerSyncJob
  );

  // Register Jellyfin sync workers
  await boss.work(
    JELLYFIN_JOB_NAMES.FULL_SYNC,
    { teamSize: 1, teamConcurrency: 1 }, // Limited concurrency for heavy operations
    jellyfinFullSyncWorker
  );
  await boss.work(
    JELLYFIN_JOB_NAMES.USERS_SYNC,
    { teamSize: 2, teamConcurrency: 2 },
    jellyfinUsersSyncWorker
  );
  await boss.work(
    JELLYFIN_JOB_NAMES.LIBRARIES_SYNC,
    { teamSize: 2, teamConcurrency: 2 },
    jellyfinLibrariesSyncWorker
  );
  await boss.work(
    JELLYFIN_JOB_NAMES.ITEMS_SYNC,
    { teamSize: 1, teamConcurrency: 1 }, // Limited concurrency for heavy operations
    jellyfinItemsSyncWorker
  );
  await boss.work(
    JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC,
    { teamSize: 2, teamConcurrency: 2 },
    jellyfinActivitiesSyncWorker
  );
  await boss.work(
    JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC,
    { teamSize: 3, teamConcurrency: 3 }, // Higher concurrency for lighter operations
    jellyfinRecentItemsSyncWorker
  );
  await boss.work(
    JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC,
    { teamSize: 3, teamConcurrency: 3 }, // Higher concurrency for lighter operations
    jellyfinRecentActivitiesSyncWorker
  );

  // Register historical sessions processing job
  await boss.work(
    "process-historical-sessions",
    { teamSize: 1, teamConcurrency: 1 }, // Single worker for heavy processing
    processHistoricalSessionsJob
  );

  console.log("All job handlers registered successfully");
}

export async function closeJobQueue(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
    bossInstance = null;
  }
}

// Job queue utilities
export const JobTypes = {
  SYNC_SERVER_DATA: "sync-server-data",
  ADD_SERVER: "add-server",
  SEQUENTIAL_SERVER_SYNC: "sequential-server-sync",
  PROCESS_HISTORICAL_SESSIONS: "process-historical-sessions",
} as const;
