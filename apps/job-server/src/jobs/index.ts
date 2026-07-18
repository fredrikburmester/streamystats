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

export {
  buildRecommendationGraphJob,
  RECOMMENDATION_GRAPH_JOB_NAME,
  type RecommendationGraphJobData,
  type RecommendationGraphResult,
} from "./recommendation-graph-job";

export { TIMEOUT_CONFIG } from "./config";

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
