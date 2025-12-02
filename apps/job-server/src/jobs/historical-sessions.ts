import {
  db,
  activities,
  sessions,
  items,
  users,
  servers,
  NewSession,
} from "@streamystats/database";
import { eq, and, or, gte, lte, desc, asc, like, ilike } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { logJobResult } from "./job-logger";
import { syncActivities, ActivitySyncOptions } from "../jellyfin/sync/activities";

interface HistoricalSessionData {
  userId: string;
  userName: string;
  itemId: string;
  itemName: string;
  seriesId?: string;
  seriesName?: string;
  seasonId?: string;
  startTime: Date;
  endTime: Date;
  playDuration: number;
  completed: boolean;
  percentComplete: number;
}

interface ProcessingStats {
  activitiesSynced: number;
  activitiesProcessed: number;
  sessionsCreated: number;
  sessionsSkipped: number;
  duplicatesFound: number;
  errors: number;
  errorDetails: Array<{
    activityId: number;
    error: string;
    timestamp: Date;
  }>;
}

/**
 * Job: Process historical activity log entries to create session records
 */
export async function processHistoricalSessionsJob(job: any) {
  const startTime = Date.now();
  const { 
    serverId, 
    startDate = '2025-04-01', // Default to April 1, 2025
    endDate = new Date().toISOString().split('T')[0], // Default to today
    batchSize = 1000 
  } = job.data;

  const stats: ProcessingStats = {
    activitiesSynced: 0,
    activitiesProcessed: 0,
    sessionsCreated: 0,
    sessionsSkipped: 0,
    duplicatesFound: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    console.log(`[Historical Sessions] Starting job for server ${serverId}`);
    console.log(`[Historical Sessions] Parameters:`, {
      serverId,
      startDate,
      endDate,
      batchSize
    });
    console.log(`Date range: ${startDate} to ${endDate}`);

    // Step 1: Sync activities from Jellyfin first
    await syncActivitiesFromJellyfin(serverId, stats);

    // Step 2: Process activities in batches to avoid memory issues
    let offset = 0;
    let hasMoreActivities = true;

    while (hasMoreActivities) {
      const activities = await getPlaybackActivities(
        serverId,
        startDate,
        endDate,
        batchSize,
        offset
      );

      if (activities.length === 0) {
        hasMoreActivities = false;
        break;
      }

      console.log(`[Historical Sessions] Processing batch ${Math.floor(offset / batchSize) + 1}: ${activities.length} activities (offset: ${offset})`);

      // Group activities by user and item to reconstruct sessions
      const sessionGroups = await groupActivitiesIntoSessions(activities);
      
      // Process each session group
      console.log(`[Historical Sessions] Found ${sessionGroups.length} session groups in this batch`);
      
      for (const [index, sessionData] of sessionGroups.entries()) {
        try {
          const result = await createHistoricalSession(serverId, sessionData);
          
          if (result.created) {
            stats.sessionsCreated++;
          } else if (result.duplicate) {
            stats.duplicatesFound++;
            stats.sessionsSkipped++;
          }
          
          if ((index + 1) % 10 === 0) {
            console.log(`[Historical Sessions] Processed ${index + 1}/${sessionGroups.length} sessions in current batch (${stats.sessionsCreated} created, ${stats.duplicatesFound} duplicates)`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[Historical Sessions] Error creating session for user ${sessionData.userId}, item ${sessionData.itemId}:`, errorMsg);
          
          stats.errors++;
          stats.errorDetails.push({
            activityId: 0, // We don't have individual activity ID here
            error: `Session creation failed: ${errorMsg}`,
            timestamp: new Date()
          });
        }
      }

      stats.activitiesProcessed += activities.length;
      offset += batchSize;
      
      console.log(`[Historical Sessions] Batch complete. Progress: ${stats.activitiesProcessed} activities processed, ${stats.sessionsCreated} sessions created, ${stats.errors} errors`);

      // Stop if we got fewer activities than requested (end of data)
      if (activities.length < batchSize) {
        console.log(`[Historical Sessions] Reached end of data (got ${activities.length} < ${batchSize})`);
        hasMoreActivities = false;
      }
    }

    const processingTime = Date.now() - startTime;
    await logJobResult(
      job.id,
      "process-historical-sessions",
      "completed",
      stats,
      processingTime
    );

    console.log(`[Historical Sessions] Job completed successfully!`);
    console.log(`[Historical Sessions] Final stats:`, {
      ...stats,
      processingTimeMs: processingTime,
      processingTimeFormatted: `${(processingTime / 1000).toFixed(2)}s`
    });
    
    if (stats.errors > 0) {
      console.warn(`[Historical Sessions] Job completed with ${stats.errors} errors. First few errors:`);
      stats.errorDetails.slice(0, 5).forEach((error, index) => {
        console.warn(`[Historical Sessions] Error ${index + 1}: ${error.error}`);
      });
    }
    
    return { success: true, stats, processingTime };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    console.error(`[Historical Sessions] Job failed after ${(processingTime / 1000).toFixed(2)}s:`, errorMsg);
    console.error(`[Historical Sessions] Progress at failure:`, stats);
    
    if (error instanceof Error && error.stack) {
      console.error(`[Historical Sessions] Stack trace:`, error.stack);
    }
    
    await logJobResult(
      job.id,
      "process-historical-sessions",
      "failed",
      {
        ...stats,
        finalError: errorMsg,
        failurePoint: 'main_processing_loop'
      },
      processingTime,
      error
    );
    
    throw new Error(`Historical sessions processing failed: ${errorMsg}`);
  }
}

/**
 * Sync activities from Jellyfin before processing sessions
 */
async function syncActivitiesFromJellyfin(
  serverId: number,
  stats: ProcessingStats
): Promise<void> {
  try {
    console.log(`[Historical Sessions] Syncing activities from Jellyfin for server ${serverId}`);
    
    // Get server details
    const serverData = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);
      
    if (serverData.length === 0) {
      throw new Error(`Server ${serverId} not found`);
    }
    
    const server = serverData[0];
    
    // Configure sync options for comprehensive historical sync
    const syncOptions: ActivitySyncOptions = {
      pageSize: 100,
      maxPages: 2000, // Allow more pages for historical data
      concurrency: 3, // Lower concurrency to be gentler on Jellyfin
      apiRequestDelayMs: 200, // Longer delay between requests
      intelligent: false // Full sync, not intelligent
    };
    
    console.log(`[Historical Sessions] Starting activity sync with options:`, syncOptions);
    
    const syncResult = await syncActivities(server, syncOptions);
    
    if (syncResult.status === 'success' || syncResult.status === 'partial') {
      stats.activitiesSynced = syncResult.data.activitiesProcessed;
      console.log(`[Historical Sessions] Activity sync completed:`, {
        status: syncResult.status,
        activitiesProcessed: syncResult.data.activitiesProcessed,
        activitiesInserted: syncResult.data.activitiesInserted,
        activitiesUpdated: syncResult.data.activitiesUpdated,
        pagesFetched: syncResult.data.pagesFetched
      });
      
      if (syncResult.status === 'partial' && syncResult.errors) {
        console.warn(`[Historical Sessions] Activity sync completed with ${syncResult.errors.length} errors:`, syncResult.errors.slice(0, 3));
      }
    } else {
      throw new Error(`Activity sync failed: ${syncResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Historical Sessions] Failed to sync activities from Jellyfin:`, errorMsg);
    
    stats.errors++;
    stats.errorDetails.push({
      activityId: 0,
      error: `Activity sync failed: ${errorMsg}`,
      timestamp: new Date()
    });
    
    throw new Error(`Failed to sync activities from Jellyfin: ${errorMsg}`);
  }
}

/**
 * Get playback-related activities from the database
 */
async function getPlaybackActivities(
  serverId: number,
  startDate?: string,
  endDate?: string,
  limit: number = 1000,
  offset: number = 0
) {
  try {
    console.log(`[Historical Sessions] Fetching activities for server ${serverId}, offset ${offset}, limit ${limit}`);
    
    // First, let's check what activities exist and their names for debugging
    if (offset === 0) {
      console.log(`[Historical Sessions] Debugging: Checking available activity types...`);
      const sampleActivities = await db
        .select({ name: activities.name, date: activities.date })
        .from(activities)
        .where(eq(activities.serverId, serverId))
        .orderBy(desc(activities.date))
        .limit(10);
      
      console.log(`[Historical Sessions] Sample activity names:`, sampleActivities.map(a => a.name));
      
      // Check total activities count
      const totalCount = await db
        .select({ count: activities.id })
        .from(activities)
        .where(eq(activities.serverId, serverId));
      
      console.log(`[Historical Sessions] Total activities for server ${serverId}: ${totalCount.length}`);
    }
    
    // Build conditions array with broader playback filtering
    const conditions = [eq(activities.serverId, serverId)];
    
    // Use broader filtering for playback-related activities (case-insensitive)
    const playbackConditions = [
      ilike(activities.name, '%playback%'),
      ilike(activities.name, '%playing%'),
      ilike(activities.name, '%started%'),
      ilike(activities.name, '%stopped%'),
      ilike(activities.name, '%paused%'),
      ilike(activities.name, '%resumed%'),
      ilike(activities.name, '%completed%'),
      ilike(activities.name, '%watched%'),
      ilike(activities.name, '%viewing%')
    ];

    // Add date filters if provided
    if (startDate) {
      conditions.push(gte(activities.date, new Date(startDate)));
      console.log(`[Historical Sessions] Start date filter: ${startDate}`);
    }

    if (endDate) {
      conditions.push(lte(activities.date, new Date(endDate)));
      console.log(`[Historical Sessions] End date filter: ${endDate}`);
    }

    // Try with broader playback filtering first
    let result = await db
      .select()
      .from(activities)
      .where(and(...conditions, or(...playbackConditions)))
      .orderBy(asc(activities.date))
      .limit(limit)
      .offset(offset);
    
    console.log(`[Historical Sessions] Retrieved ${result.length} activities with broad playback filter`);
    
    // If no results with broad filter, try without playback filtering for debugging
    if (result.length === 0 && offset === 0) {
      console.log(`[Historical Sessions] No playback activities found, checking all activities in date range...`);
      const allInRange = await db
        .select()
        .from(activities)
        .where(and(...conditions))
        .orderBy(asc(activities.date))
        .limit(10);
      
      console.log(`[Historical Sessions] Sample activities in date range:`, allInRange.map(a => ({ name: a.name, date: a.date })));
      
      if (allInRange.length === 0) {
        console.warn(`[Historical Sessions] No activities found in date range ${startDate} to ${endDate}`);
      }
    }
    
    return result;
  } catch (error) {
    console.error(`[Historical Sessions] Error fetching activities:`, error);
    throw new Error(`Failed to fetch playback activities: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Group activities into logical sessions based on user, item, and timing
 */
async function groupActivitiesIntoSessions(
  activities: any[]
): Promise<HistoricalSessionData[]> {
  const sessions: HistoricalSessionData[] = [];
  const sessionMap = new Map<string, any[]>();

  // Group activities by user + item + approximate time window
  for (const activity of activities) {
    if (!activity.userId || !activity.itemId) continue;

    // Create a session key based on user, item, and time window (1 hour windows)
    const timeWindow = Math.floor(activity.date.getTime() / (1000 * 60 * 60)); // 1-hour windows
    const sessionKey = `${activity.userId}_${activity.itemId}_${timeWindow}`;

    if (!sessionMap.has(sessionKey)) {
      sessionMap.set(sessionKey, []);
    }
    sessionMap.get(sessionKey)!.push(activity);
  }

  // Process each session group
  for (const [sessionKey, sessionActivities] of sessionMap) {
    try {
      const sessionData = await reconstructSession(sessionActivities);
      if (sessionData) {
        sessions.push(sessionData);
      }
    } catch (error) {
      console.error(`Error reconstructing session for key ${sessionKey}:`, error);
    }
  }

  return sessions;
}

/**
 * Reconstruct session data from a group of activities
 * 
 * Takes a collection of related activities (same user + item + time window)
 * and attempts to reconstruct what the viewing session looked like.
 * 
 * This is necessary because Jellyfin's activity log contains individual events
 * (playback started, paused, stopped, etc.) but doesn't store complete session records.
 * We need to piece together these events to understand the full viewing experience.
 */
async function reconstructSession(
  activities: any[]
): Promise<HistoricalSessionData | null> {
  // Skip empty activity groups (shouldn't happen, but safety check)
  if (activities.length === 0) return null;

  // Sort activities chronologically to establish session timeline
  // This gives us the sequence: start → pause/resume → stop
  activities.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Use first and last activities to determine session boundaries
  const firstActivity = activities[0];   // Session start time
  const lastActivity = activities[activities.length - 1];  // Session end time

  // Validate that the media item still exists in our database
  // Items might be missing due to:
  // - Sync timing issues (activity synced before item sync)
  // - Deleted items (removed from Jellyfin after activity was logged)
  // - System activities that don't reference actual media items
  // - Library restructuring or permission changes
  const itemData = await db
    .select()
    .from(items)
    .where(eq(items.id, firstActivity.itemId))
    .limit(1);

  if (itemData.length === 0) {
    // This is expected for system activities, library operations, etc.
    // Only log as warning since it might indicate sync issues for actual media
    console.warn(`[Historical Sessions] Item ${firstActivity.itemId} not found for activity "${firstActivity.name}", skipping session`);
    return null;
  }

  const item = itemData[0];

  // Validate that the user still exists in our database
  // Users might be missing due to:
  // - User account deletion after activity was logged
  // - Sync timing issues
  // - System activities with invalid user references
  const userData = await db
    .select()
    .from(users)
    .where(eq(users.id, firstActivity.userId))
    .limit(1);

  if (userData.length === 0) {
    console.warn(`[Historical Sessions] User ${firstActivity.userId} not found, skipping session`);
    return null;
  }

  const user = userData[0];

  // Calculate session timing based on activity timestamps
  // Note: This is an estimation since activity logs don't track exact playback time
  const startTime = firstActivity.date;  // When user started watching
  const endTime = lastActivity.date;     // When user stopped/finished
  const timeDiff = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  
  // Estimate actual playback duration
  // We assume 80% of the time difference was actual viewing (accounting for pauses, buffering, etc.)
  // Set minimum of 1 minute to avoid zero-duration sessions from rapid start/stop events
  const estimatedPlayDuration = Math.max(60, Math.floor(timeDiff * 0.8));

  // Determine if the user completed watching the item
  // Look for activity names that indicate completion ("stopped", "completed", etc.)
  const hasCompletionActivity = activities.some(a => 
    a.name.toLowerCase().includes('stopped') || 
    a.name.toLowerCase().includes('completed')
  );
  
  // Calculate viewing progress as a percentage
  // This is an estimation since we don't have exact playback position from activity logs
  let percentComplete = 0;
  let completed = false;

  if (item.runtimeTicks && item.runtimeTicks > 0) {
    // If we have the item's actual runtime, calculate percentage based on estimated watch time
    // runtimeTicks is in 100-nanosecond units, so divide by 10,000,000 to get seconds
    const runtimeSeconds = Math.floor(item.runtimeTicks / 10_000_000);
    percentComplete = Math.min(100, (estimatedPlayDuration / runtimeSeconds) * 100);
    
    // Consider completed if >90% watched OR if there's a completion activity
    completed = percentComplete > 90 || hasCompletionActivity;
  } else {
    // If no runtime data available, fall back to activity pattern analysis
    completed = hasCompletionActivity;
    percentComplete = completed ? 95 : 50; // Rough estimates when runtime unknown
  }

  // Return the reconstructed session data
  // This represents our best estimate of what the viewing session looked like
  return {
    userId: user.id,
    userName: user.name,
    itemId: item.id,
    itemName: item.name || 'Unknown',
    seriesId: item.seriesId || undefined,      // For TV episodes
    seriesName: item.seriesName || undefined,  // For TV episodes  
    seasonId: item.seasonId || undefined,      // For TV episodes
    startTime,                                 // When viewing began
    endTime,                                   // When viewing ended
    playDuration: estimatedPlayDuration,       // Estimated actual watch time (seconds)
    completed,                                 // Whether user finished watching
    percentComplete,                           // How much was watched (0-100%)
  };
}

/**
 * Create a session record from historical data
 */
async function createHistoricalSession(
  serverId: number,
  sessionData: HistoricalSessionData
): Promise<{ created: boolean; duplicate: boolean }> {
  try {
    console.log(`[Historical Sessions] Creating session for user ${sessionData.userId}, item ${sessionData.itemId}`);
    
    // Check if a similar session already exists to avoid duplicates
    const existingSession = await db
      .select()
      .from(sessions)
      .where(
        and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, sessionData.userId),
        eq(sessions.itemId, sessionData.itemId),
        gte(sessions.startTime, new Date(sessionData.startTime.getTime() - 30 * 60 * 1000)), // 30 min window
        lte(sessions.startTime, new Date(sessionData.startTime.getTime() + 30 * 60 * 1000))
      )
    )
    .limit(1);

  if (existingSession.length > 0) {
    console.debug(`[Historical Sessions] Duplicate session found for ${sessionData.userName} - ${sessionData.itemName} at ${sessionData.startTime}, skipping`);
    return { created: false, duplicate: true };
  }

  const sessionRecord: NewSession = {
    id: uuidv4(),
    serverId,
    userId: sessionData.userId,
    itemId: sessionData.itemId,
    userName: sessionData.userName,
    userServerId: sessionData.userId, // Using same as userId for historical data
    deviceId: null, // Not available in activity logs
    deviceName: 'Historical Import',
    clientName: 'Historical Import',
    applicationVersion: null,
    remoteEndPoint: null,
    itemName: sessionData.itemName,
    seriesId: sessionData.seriesId || null,
    seriesName: sessionData.seriesName || null,
    seasonId: sessionData.seasonId || null,
    playDuration: sessionData.playDuration,
    startTime: sessionData.startTime,
    endTime: sessionData.endTime,
    lastActivityDate: sessionData.endTime,
    lastPlaybackCheckIn: null,
    runtimeTicks: null, // Will be populated from item data if available
    positionTicks: null, // Not available in activity logs
    percentComplete: sessionData.percentComplete,
    completed: sessionData.completed,
    isPaused: false,
    isMuted: false,
    isActive: false,
    volumeLevel: null,
    audioStreamIndex: null,
    subtitleStreamIndex: null,
    playMethod: 'Unknown', // Not available in activity logs
    isTranscoded: false, // Unknown from activity logs
    mediaSourceId: null,
    repeatMode: null,
    playbackOrder: null,
    transcodingAudioCodec: null,
    transcodingVideoCodec: null,
    transcodingContainer: null,
    transcodingIsVideoDirect: null,
    transcodingIsAudioDirect: null,
    transcodingBitrate: null,
    transcodingCompletionPercentage: null,
    transcodingWidth: null,
    transcodingHeight: null,
    transcodingAudioChannels: null,
    transcodingHardwareAccelerationType: null,
    transcodeReasons: null,
    rawData: {
      source: 'historical_import',
      originalActivities: sessionData,
    },
  };

    await db.insert(sessions).values(sessionRecord);
    
    console.info(
      `[Historical Sessions] Created session: ${sessionData.userName} watched ${sessionData.itemName} ` +
      `for ${Math.floor(sessionData.playDuration / 60)}m (${Math.round(sessionData.percentComplete)}% complete)`
    );
    
    return { created: true, duplicate: false };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Historical Sessions] Failed to create session for user ${sessionData.userId}, item ${sessionData.itemId}:`, errorMsg);
    
    if (error instanceof Error && error.stack) {
      console.error(`[Historical Sessions] Stack trace:`, error.stack);
    }
    
    throw new Error(`Failed to create historical session: ${errorMsg}`);
  }
}
