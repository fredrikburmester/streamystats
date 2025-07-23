// Export all job functions from their respective modules
export {
  syncServerDataJob,
  addServerJob,
  sequentialServerSyncJob,
} from "./server-jobs";

export { generateItemEmbeddingsJob } from "./embedding-jobs";
export { generateJellyseerrEmbeddingsJob } from "./jellyseerr-embedding-jobs";

export { syncJellyseerrPopularMoviesJob } from "./jellyseerr-jobs";

export {
  syncUsers,
  syncLibraries,
  syncActivities,
  syncItems,
} from "./sync-helpers";

export { logJobResult } from "./job-logger";

export { openai, OPENAI_CONFIG, TIMEOUT_CONFIG } from "./config";

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
  JELLYFIN_JOB_NAMES,
} from "../jellyfin/workers";
