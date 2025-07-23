"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobTypes = void 0;
exports.getJobQueue = getJobQueue;
exports.closeJobQueue = closeJobQueue;
const pg_boss_1 = __importDefault(require("pg-boss"));
const dotenv = __importStar(require("dotenv"));
const workers_1 = require("./workers");
dotenv.config();
let bossInstance = null;
async function getJobQueue() {
    if (bossInstance) {
        return bossInstance;
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL environment variable is not set");
    }
    bossInstance = new pg_boss_1.default({
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
async function registerJobHandlers(boss) {
    // Register media server job types
    await boss.work("sync-server-data", { teamSize: 2, teamConcurrency: 1 }, // Limited concurrency for API rate limiting
    workers_1.syncServerDataJob);
    await boss.work("add-server", { teamSize: 1, teamConcurrency: 1 }, workers_1.addServerJob);
    // Register item embeddings job
    await boss.work("generate-item-embeddings", { teamSize: 1, teamConcurrency: 1 }, // Limited for API rate limiting
    workers_1.generateItemEmbeddingsJob);
    // Register Jellyseerr embeddings job
    await boss.work("generate-jellyseerr-embeddings", { teamSize: 1, teamConcurrency: 1 }, // Limited for API rate limiting
    workers_1.generateJellyseerrEmbeddingsJob);
    // Register new sequential server sync job type
    await boss.work("sequential-server-sync", { teamSize: 1, teamConcurrency: 1 }, workers_1.sequentialServerSyncJob);
    // Register Jellyseerr sync job
    await boss.work("sync-jellyseerr-popular-movies", { teamSize: 1, teamConcurrency: 1 }, workers_1.syncJellyseerrPopularMoviesJob);
    // Register Jellyfin sync workers
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.FULL_SYNC, { teamSize: 1, teamConcurrency: 1 }, // Limited concurrency for heavy operations
    workers_1.jellyfinFullSyncWorker);
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.USERS_SYNC, { teamSize: 2, teamConcurrency: 2 }, workers_1.jellyfinUsersSyncWorker);
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.LIBRARIES_SYNC, { teamSize: 2, teamConcurrency: 2 }, workers_1.jellyfinLibrariesSyncWorker);
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.ITEMS_SYNC, { teamSize: 1, teamConcurrency: 1 }, // Limited concurrency for heavy operations
    workers_1.jellyfinItemsSyncWorker);
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.ACTIVITIES_SYNC, { teamSize: 2, teamConcurrency: 2 }, workers_1.jellyfinActivitiesSyncWorker);
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.RECENT_ITEMS_SYNC, { teamSize: 3, teamConcurrency: 3 }, // Higher concurrency for lighter operations
    workers_1.jellyfinRecentItemsSyncWorker);
    await boss.work(workers_1.JELLYFIN_JOB_NAMES.RECENT_ACTIVITIES_SYNC, { teamSize: 3, teamConcurrency: 3 }, // Higher concurrency for lighter operations
    workers_1.jellyfinRecentActivitiesSyncWorker);
    console.log("All job handlers registered successfully");
}
async function closeJobQueue() {
    if (bossInstance) {
        await bossInstance.stop();
        bossInstance = null;
    }
}
// Job queue utilities
exports.JobTypes = {
    SYNC_SERVER_DATA: "sync-server-data",
    ADD_SERVER: "add-server",
    GENERATE_ITEM_EMBEDDINGS: "generate-item-embeddings",
    GENERATE_JELLYSEERR_EMBEDDINGS: "generate-jellyseerr-embeddings",
    SEQUENTIAL_SERVER_SYNC: "sequential-server-sync",
    SYNC_JELLYSEERR_POPULAR_MOVIES: "sync-jellyseerr-popular-movies",
};
