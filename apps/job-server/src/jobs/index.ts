// Export all job functions from their respective modules
export {
  addServerJob,
  backfillJellyfinIdsJob,
  BACKFILL_JOB_NAMES,
} from "./server-jobs";

export { generateItemEmbeddingsJob } from "./embedding-jobs";

export {
  geolocateActivitiesJob,
  calculateFingerprintsJob,
  backfillActivityLocationsJob,
  GEOLOCATION_JOB_NAMES,
} from "./geolocation-jobs";

export { logJobResult } from "./job-logger";

export {
  inferWatchtimeJob,
  INFER_WATCHTIME_JOB_NAME,
  type InferWatchtimeJobData,
  type InferWatchtimeResult,
} from "./infer-watchtime-job";

export { TIMEOUT_CONFIG } from "./config";

export {
  calculateUserEmbeddingsJob,
  USER_EMBEDDING_JOB_NAME,
} from "./user-embedding-job";

// Export Jellyfin sync workers from the original location
export {
  jellyfinSyncWorker,
  jellyfinFullSyncWorker,
  jellyfinUsersSyncWorker,
  jellyfinLibrariesSyncWorker,
  jellyfinItemsSyncWorker,
  jellyfinActivitiesSyncWorker,
  jellyfinRecentItemsSyncWorker,
  jellyfinRecentActivitiesSyncWorker,
  jellyfinPeopleSyncWorker,
  JELLYFIN_JOB_NAMES,
} from "../jellyfin/workers";
