import { eq } from "drizzle-orm";
import { db, libraries, Server, NewLibrary } from "@streamystats/database";
import { JellyfinClient, JellyfinLibrary } from "../client";
import {
  SyncMetricsTracker,
  SyncResult,
  createSyncResult,
} from "../sync-metrics";
import pMap from "p-map";
import { formatSyncLogLine } from "./sync-log";
import { formatError } from "../../utils/format-error";

export interface LibrarySyncOptions {
  batchSize?: number;
  concurrency?: number;
}

export interface LibrarySyncData {
  librariesProcessed: number;
  librariesInserted: number;
  librariesUpdated: number;
}

export async function syncLibraries(
  server: Server,
  options: LibrarySyncOptions = {}
): Promise<SyncResult<LibrarySyncData>> {
  const { batchSize = 100, concurrency = 5 } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    // Fetch libraries from Jellyfin
    metrics.incrementApiRequests();
    const jellyfinLibraries = await client.getLibraries();

    console.info(
      formatSyncLogLine("libraries-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        fetched: jellyfinLibraries.length,
      })
    );

    for (
      let offset = 0, page = 1;
      offset < jellyfinLibraries.length;
      offset += batchSize, page++
    ) {
      const chunk = jellyfinLibraries.slice(offset, offset + batchSize);
      const before = metrics.getCurrentMetrics();
      const processStart = Date.now();

      await pMap(
        chunk,
        async (jellyfinLibrary) => {
          try {
            const wasInserted = await processLibrary(
              jellyfinLibrary,
              server.id,
              metrics
            );

            if (wasInserted) {
              metrics.incrementLibrariesInserted();
            } else {
              metrics.incrementLibrariesUpdated();
            }

            metrics.incrementLibrariesProcessed();
          } catch (error) {
            console.error(
              `[libraries-sync] server=${server.name} libraryId=${jellyfinLibrary.Id} status=process-error error=${formatError(
                error
              )}`
            );
            metrics.incrementErrors();
            errors.push(
              `Library ${jellyfinLibrary.Id}: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
          }
        },
        { concurrency }
      );

      const processMs = Date.now() - processStart;
      const after = metrics.getCurrentMetrics();

      console.info(
        formatSyncLogLine("libraries-sync", {
          server: server.name,
          page,
          processed: after.librariesProcessed - before.librariesProcessed,
          inserted: after.librariesInserted - before.librariesInserted,
          updated: after.librariesUpdated - before.librariesUpdated,
          errors: after.errors - before.errors,
          processMs,
          totalProcessed: after.librariesProcessed,
        })
      );
    }

    // Remove libraries that no longer exist in Jellyfin
    const jellyfinLibraryIds = jellyfinLibraries.map((lib) => lib.Id);
    if (jellyfinLibraryIds.length > 0) {
      const existingLibraries = await db
        .select({ id: libraries.id })
        .from(libraries)
        .where(eq(libraries.serverId, server.id));

      const staleLibraryIds = existingLibraries
        .map((lib) => lib.id)
        .filter((id) => !jellyfinLibraryIds.includes(id));

      for (const staleId of staleLibraryIds) {
        await db.delete(libraries).where(eq(libraries.id, staleId));
        metrics.incrementDatabaseOperations();
        console.info(
          `[libraries-sync] server=${server.name} removed stale library=${staleId}`
        );
      }
    }

    const finalMetrics = metrics.finish();
    const data: LibrarySyncData = {
      librariesProcessed: finalMetrics.librariesProcessed,
      librariesInserted: finalMetrics.librariesInserted,
      librariesUpdated: finalMetrics.librariesUpdated,
    };

    console.info(
      formatSyncLogLine("libraries-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: errors.length,
        processMs: finalMetrics.duration ?? 0,
        totalProcessed: finalMetrics.librariesProcessed,
      })
    );

    if (errors.length > 0) {
      return createSyncResult("partial", data, finalMetrics, undefined, errors);
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      `[libraries-sync] server=${server.name} status=failed error=${formatError(
        error
      )}`
    );
    const finalMetrics = metrics.finish();
    const errorData: LibrarySyncData = {
      librariesProcessed: finalMetrics.librariesProcessed,
      librariesInserted: finalMetrics.librariesInserted,
      librariesUpdated: finalMetrics.librariesUpdated,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function processLibrary(
  jellyfinLibrary: JellyfinLibrary,
  serverId: number,
  metrics: SyncMetricsTracker
): Promise<boolean> {
  // Check if library already exists
  const existingLibrary = await db
    .select()
    .from(libraries)
    .where(eq(libraries.id, jellyfinLibrary.Id))
    .limit(1);

  const libraryData: NewLibrary = {
    id: jellyfinLibrary.Id,
    name: jellyfinLibrary.Name,
    type: jellyfinLibrary.CollectionType || jellyfinLibrary.Type || "Unknown",
    serverId,
    updatedAt: new Date(),
  };

  const isNewLibrary = existingLibrary.length === 0;

  // Upsert library (insert or update if exists)
  await db
    .insert(libraries)
    .values(libraryData)
    .onConflictDoUpdate({
      target: libraries.id,
      set: {
        ...libraryData,
        updatedAt: new Date(),
      },
    });

  metrics.incrementDatabaseOperations();
  return isNewLibrary;
}
