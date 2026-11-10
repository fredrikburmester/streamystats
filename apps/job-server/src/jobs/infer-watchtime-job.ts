import { db, servers, sessions, items, users, type NewSession } from "@streamystats/database";
import { eq, and, gte, lte } from "drizzle-orm";
import { JellyfinClient } from "../jellyfin/client";
import { logJobResult } from "./job-logger";
import { structuredLog as log } from "../utils/structured-log";
import type { PgBossJob } from "../types/job-status";

export const INFER_WATCHTIME_JOB_NAME = "infer-watchtime-from-userdata";

export interface InferWatchtimeJobData {
  serverId: number;
  userId?: string; // If not provided, process all users
  triggeredBy: string; // User ID who triggered this
  isAdmin: boolean;
}

export interface InferWatchtimeResult {
  serverId: number;
  userId?: string;
  processed: number;
  skipped: number;
  created: number;
  errors: number;
}

/**
 * Generate a deterministic session ID for inferred sessions.
 * This helps with duplicate detection if the job is run multiple times.
 */
function generateInferredSessionId(
  serverId: number,
  oduserId: string,
  itemId: string,
  lastPlayedDate: string
): string {
  return `inferred:${serverId}:${oduserId}:${itemId}:${lastPlayedDate}`;
}

/**
 * Check if a session already exists for this user+item combination.
 * Uses multiple fields for duplicate detection.
 */
async function hasExistingSession(
  serverId: number,
  userId: string,
  itemId: string,
  lastPlayedDate: Date
): Promise<boolean> {
  // Check for exact inferred session match
  const inferredId = generateInferredSessionId(
    serverId,
    userId,
    itemId,
    lastPlayedDate.toISOString()
  );

  const existing = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, inferredId))
    .limit(1);

  if (existing.length > 0) {
    return true;
  }

  // Also check for any real session within 24 hours of the LastPlayedDate
  // This prevents creating inferred sessions when real sessions exist
  const dayBefore = new Date(lastPlayedDate.getTime() - 24 * 60 * 60 * 1000);
  const dayAfter = new Date(lastPlayedDate.getTime() + 24 * 60 * 60 * 1000);

  const nearbySession = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        eq(sessions.itemId, itemId),
        gte(sessions.startTime, dayBefore),
        lte(sessions.startTime, dayAfter)
      )
    )
    .limit(1);

  return nearbySession.length > 0;
}

export async function inferWatchtimeJob(
  job: PgBossJob<InferWatchtimeJobData>
): Promise<InferWatchtimeResult> {
  const startTime = Date.now();
  const { serverId, userId, triggeredBy, isAdmin } = job.data;

  const result: InferWatchtimeResult = {
    serverId,
    userId,
    processed: 0,
    skipped: 0,
    created: 0,
    errors: 0,
  };

  try {
    log(INFER_WATCHTIME_JOB_NAME, { action: "start", serverId, userId: userId ?? "all" });

    // Get server configuration
    const server = await db.query.servers.findFirst({
      where: eq(servers.id, serverId),
    });

    if (!server) {
      throw new Error(`Server with ID ${serverId} not found`);
    }

    const client = JellyfinClient.fromServer(server);

    // Determine which users to process
    let usersToProcess: Array<{ id: string; name: string }> = [];

    if (userId) {
      // Single user mode - verify user exists
      const user = await db.query.users.findFirst({
        where: and(eq(users.id, userId), eq(users.serverId, serverId)),
      });

      if (!user) {
        throw new Error(`User ${userId} not found on server ${serverId}`);
      }

      // Security check: non-admins can only trigger for themselves
      if (!isAdmin && triggeredBy !== userId) {
        throw new Error("Non-admins can only infer watchtime for themselves");
      }

      usersToProcess = [{ id: user.id, name: user.name }];
    } else {
      // All users mode - admin only
      if (!isAdmin) {
        throw new Error("Only admins can trigger inference for all users");
      }

      const allUsers = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.serverId, serverId));

      usersToProcess = allUsers;
    }

    log(INFER_WATCHTIME_JOB_NAME, {
      action: "processing_users",
      count: usersToProcess.length,
    });

    // Process each user
    for (const user of usersToProcess) {
      try {
        log(INFER_WATCHTIME_JOB_NAME, {
          action: "fetching_played_items",
          userName: user.name,
        });

        // Fetch played items for this user
        const playedItems = await client.getUserPlayedItems(user.id);

        log(INFER_WATCHTIME_JOB_NAME, {
          action: "found_played_items",
          userName: user.name,
          count: playedItems.length,
        });

        for (const item of playedItems) {
          result.processed++;

          const userData = item.UserData;

          // Skip if no UserData or not marked as played
          if (!userData?.Played) {
            result.skipped++;
            continue;
          }

          // Skip if no LastPlayedDate
          if (!userData.LastPlayedDate) {
            result.skipped++;
            continue;
          }

          const lastPlayedDate = new Date(userData.LastPlayedDate);

          log(INFER_WATCHTIME_JOB_NAME, {
            action: "processing_item",
            itemName: item.Name,
            lastPlayedDate: lastPlayedDate.toISOString(),
          });

          // Check for existing sessions (duplicate prevention)
          const exists = await hasExistingSession(
            serverId,
            user.id,
            item.Id,
            lastPlayedDate
          );

          if (exists) {
            result.skipped++;
            continue;
          }

          // Verify item exists in our database
          const dbItem = await db.query.items.findFirst({
            where: and(eq(items.id, item.Id), eq(items.serverId, serverId)),
          });

          if (!dbItem) {
            result.skipped++;
            continue;
          }

          // Create inferred session with 100% watchtime
          const runtimeTicks = item.RunTimeTicks ?? dbItem.runtimeTicks ?? 0;
          const playDurationSeconds = Math.floor(runtimeTicks / 10_000_000);

          const sessionId = generateInferredSessionId(
            serverId,
            user.id,
            item.Id,
            lastPlayedDate.toISOString()
          );

          const newSession: NewSession = {
            id: sessionId,
            serverId,
            userId: user.id,
            itemId: item.Id,
            userName: user.name,
            userServerId: user.id,
            itemName: item.Name,
            seriesId: item.SeriesId ?? null,
            seriesName: item.SeriesName ?? null,
            seasonId: item.SeasonId ?? null,
            playDuration: playDurationSeconds,
            startTime: lastPlayedDate,
            endTime: lastPlayedDate,
            runtimeTicks,
            positionTicks: runtimeTicks, // Full position = completed
            percentComplete: 100,
            completed: true,
            isPaused: false,
            isMuted: false,
            isActive: false,
            isInferred: true,
            isTranscoded: false,
            rawData: {
              source: "inferred-from-userdata",
              inferredAt: new Date().toISOString(),
              originalPlayCount: userData.PlayCount ?? 1,
            },
          };

          await db.insert(sessions).values(newSession).onConflictDoNothing();
          result.created++;
        }

        log(INFER_WATCHTIME_JOB_NAME, {
          action: "user_completed",
          userName: user.name,
          created: result.created,
        });
      } catch (userError) {
        log(INFER_WATCHTIME_JOB_NAME, {
          action: "user_error",
          userName: user.name,
          error: userError instanceof Error ? userError.message : String(userError),
        });
        result.errors++;
      }
    }

    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      INFER_WATCHTIME_JOB_NAME,
      "completed",
      result as unknown as Record<string, unknown>,
      processingTime
    );

    log(INFER_WATCHTIME_JOB_NAME, {
      action: "completed",
      serverId,
      processed: result.processed,
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
    });

    return result;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      INFER_WATCHTIME_JOB_NAME,
      "failed",
      result as unknown as Record<string, unknown>,
      processingTime,
      error instanceof Error ? error : String(error)
    );
    throw error;
  }
}
