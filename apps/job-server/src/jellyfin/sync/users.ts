import { eq } from "drizzle-orm";
import { db, users, Server, NewUser } from "@streamystats/database";
import { JellyfinClient, JellyfinUser } from "../client";
import {
  SyncMetricsTracker,
  SyncResult,
  createSyncResult,
} from "../sync-metrics";
import pMap from "p-map";
import { formatSyncLogLine } from "./sync-log";
import { formatError } from "../../utils/format-error";

export interface UserSyncOptions {
  batchSize?: number;
  concurrency?: number;
}

export interface UserSyncData {
  usersProcessed: number;
  usersInserted: number;
  usersUpdated: number;
}

export async function syncUsers(
  server: Server,
  options: UserSyncOptions = {}
): Promise<SyncResult<UserSyncData>> {
  const { batchSize = 100, concurrency = 5 } = options;

  const metrics = new SyncMetricsTracker();
  const client = JellyfinClient.fromServer(server);
  const errors: string[] = [];

  try {
    // Fetch users from Jellyfin
    metrics.incrementApiRequests();
    const jellyfinUsers = await client.getUsers();

    console.info(
      formatSyncLogLine("users-sync", {
        server: server.name,
        page: 0,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: 0,
        processMs: 0,
        totalProcessed: 0,
        fetched: jellyfinUsers.length,
      })
    );

    for (let offset = 0, page = 1; offset < jellyfinUsers.length; offset += batchSize, page++) {
      const chunk = jellyfinUsers.slice(offset, offset + batchSize);
      const before = metrics.getCurrentMetrics();
      const processStart = Date.now();

      await pMap(
        chunk,
        async (jellyfinUser) => {
          try {
            const wasInserted = await processUser(jellyfinUser, server.id, metrics);
            if (wasInserted) {
              metrics.incrementUsersInserted();
            } else {
              metrics.incrementUsersUpdated();
            }
            metrics.incrementUsersProcessed();
          } catch (error) {
            console.error(
              `[users-sync] server=${server.name} userId=${jellyfinUser.Id} status=process-error error=${formatError(
                error
              )}`
            );
            metrics.incrementErrors();
            errors.push(
              `User ${jellyfinUser.Id}: ${
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
        formatSyncLogLine("users-sync", {
          server: server.name,
          page,
          processed: after.usersProcessed - before.usersProcessed,
          inserted: after.usersInserted - before.usersInserted,
          updated: after.usersUpdated - before.usersUpdated,
          errors: after.errors - before.errors,
          processMs,
          totalProcessed: after.usersProcessed,
        })
      );
    }

    const finalMetrics = metrics.finish();
    const data: UserSyncData = {
      usersProcessed: finalMetrics.usersProcessed,
      usersInserted: finalMetrics.usersInserted,
      usersUpdated: finalMetrics.usersUpdated,
    };

    console.info(
      formatSyncLogLine("users-sync", {
        server: server.name,
        page: -1,
        processed: 0,
        inserted: 0,
        updated: 0,
        errors: errors.length,
        processMs: finalMetrics.duration ?? 0,
        totalProcessed: finalMetrics.usersProcessed,
      })
    );

    if (errors.length > 0) {
      return createSyncResult("partial", data, finalMetrics, undefined, errors);
    }

    return createSyncResult("success", data, finalMetrics);
  } catch (error) {
    console.error(
      `[users-sync] server=${server.name} status=failed error=${formatError(
        error
      )}`
    );
    const finalMetrics = metrics.finish();
    const errorData: UserSyncData = {
      usersProcessed: finalMetrics.usersProcessed,
      usersInserted: finalMetrics.usersInserted,
      usersUpdated: finalMetrics.usersUpdated,
    };
    return createSyncResult(
      "error",
      errorData,
      finalMetrics,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

async function processUser(
  jellyfinUser: JellyfinUser,
  serverId: number,
  metrics: SyncMetricsTracker
): Promise<boolean> {
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, jellyfinUser.Id))
    .limit(1);

  const isNewUser = existingUser.length === 0;

  const userData: NewUser = {
    id: jellyfinUser.Id,
    name: jellyfinUser.Name,
    serverId,
    lastLoginDate: jellyfinUser.LastLoginDate
      ? new Date(jellyfinUser.LastLoginDate)
      : null,
    lastActivityDate: jellyfinUser.LastActivityDate
      ? new Date(jellyfinUser.LastActivityDate)
      : null,
    hasPassword: jellyfinUser.HasPassword,
    hasConfiguredPassword: jellyfinUser.HasConfiguredPassword,
    hasConfiguredEasyPassword: jellyfinUser.HasConfiguredEasyPassword,
    enableAutoLogin: jellyfinUser.EnableAutoLogin,
    isAdministrator: jellyfinUser.IsAdministrator,
    isHidden: jellyfinUser.IsHidden,
    isDisabled: jellyfinUser.IsDisabled,
    enableUserPreferenceAccess: jellyfinUser.EnableUserPreferenceAccess,
    enableRemoteControlOfOtherUsers:
      jellyfinUser.EnableRemoteControlOfOtherUsers,
    enableSharedDeviceControl: jellyfinUser.EnableSharedDeviceControl,
    enableRemoteAccess: jellyfinUser.EnableRemoteAccess,
    enableLiveTvManagement: jellyfinUser.EnableLiveTvManagement,
    enableLiveTvAccess: jellyfinUser.EnableLiveTvAccess,
    enableMediaPlayback: jellyfinUser.EnableMediaPlayback,
    enableAudioPlaybackTranscoding: jellyfinUser.EnableAudioPlaybackTranscoding,
    enableVideoPlaybackTranscoding: jellyfinUser.EnableVideoPlaybackTranscoding,
    enablePlaybackRemuxing: jellyfinUser.EnablePlaybackRemuxing,
    enableContentDeletion: jellyfinUser.EnableContentDeletion,
    enableContentDownloading: jellyfinUser.EnableContentDownloading,
    enableSyncTranscoding: jellyfinUser.EnableSyncTranscoding,
    enableMediaConversion: jellyfinUser.EnableMediaConversion,
    enableAllDevices: jellyfinUser.EnableAllDevices,
    enableAllChannels: jellyfinUser.EnableAllChannels,
    enableAllFolders: jellyfinUser.EnableAllFolders,
    enabledFolders:
      jellyfinUser.EnabledFolders ??
      jellyfinUser.Policy?.EnabledFolders ??
      [],
    enablePublicSharing: jellyfinUser.EnablePublicSharing,
    invalidLoginAttemptCount: jellyfinUser.InvalidLoginAttemptCount,
    loginAttemptsBeforeLockout: jellyfinUser.LoginAttemptsBeforeLockout,
    maxActiveSessions: jellyfinUser.MaxActiveSessions,
    remoteClientBitrateLimit: jellyfinUser.RemoteClientBitrateLimit,
    authenticationProviderId: jellyfinUser.AuthenticationProviderId,
    passwordResetProviderId: jellyfinUser.PasswordResetProviderId,
    syncPlayAccess: jellyfinUser.SyncPlayAccess,
    updatedAt: new Date(),
  };

  // Upsert user (insert or update if exists)
  await db
    .insert(users)
    .values(userData)
    .onConflictDoUpdate({
      target: users.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    });

  metrics.incrementDatabaseOperations();
  return isNewUser;
}
