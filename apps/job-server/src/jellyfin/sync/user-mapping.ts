import type { NewUser } from "@streamystats/database";
import type { JellyfinUser } from "../client";

/**
 * Jellyfin returns permission flags under UserDto.Policy, never at the top
 * level; defaults mirror the users table so a missing Policy yields the same
 * row a fresh insert would.
 */
export function mapJellyfinUser(
  jellyfinUser: JellyfinUser,
  serverId: number
): NewUser {
  const policy = jellyfinUser.Policy ?? {};

  return {
    id: jellyfinUser.Id,
    name: jellyfinUser.Name,
    serverId,
    lastLoginDate: parseDate(jellyfinUser.LastLoginDate),
    lastActivityDate: parseDate(jellyfinUser.LastActivityDate),
    // HasPassword is deprecated in Jellyfin 12; HasConfiguredPassword carries the same meaning.
    hasPassword:
      jellyfinUser.HasPassword ?? jellyfinUser.HasConfiguredPassword ?? false,
    hasConfiguredPassword: jellyfinUser.HasConfiguredPassword ?? false,
    hasConfiguredEasyPassword: jellyfinUser.HasConfiguredEasyPassword ?? false,
    enableAutoLogin: jellyfinUser.EnableAutoLogin ?? false,
    isAdministrator: policy.IsAdministrator ?? false,
    isHidden: policy.IsHidden ?? false,
    isDisabled: policy.IsDisabled ?? false,
    enableUserPreferenceAccess: policy.EnableUserPreferenceAccess ?? true,
    enableRemoteControlOfOtherUsers:
      policy.EnableRemoteControlOfOtherUsers ?? false,
    enableSharedDeviceControl: policy.EnableSharedDeviceControl ?? false,
    enableRemoteAccess: policy.EnableRemoteAccess ?? true,
    enableLiveTvManagement: policy.EnableLiveTvManagement ?? false,
    enableLiveTvAccess: policy.EnableLiveTvAccess ?? true,
    enableMediaPlayback: policy.EnableMediaPlayback ?? true,
    enableAudioPlaybackTranscoding:
      policy.EnableAudioPlaybackTranscoding ?? true,
    enableVideoPlaybackTranscoding:
      policy.EnableVideoPlaybackTranscoding ?? true,
    enablePlaybackRemuxing: policy.EnablePlaybackRemuxing ?? true,
    enableContentDeletion: policy.EnableContentDeletion ?? false,
    enableContentDownloading: policy.EnableContentDownloading ?? false,
    enableSyncTranscoding: policy.EnableSyncTranscoding ?? true,
    enableMediaConversion: policy.EnableMediaConversion ?? false,
    enableAllDevices: policy.EnableAllDevices ?? true,
    enableAllChannels: policy.EnableAllChannels ?? true,
    enableAllFolders: policy.EnableAllFolders ?? true,
    enabledFolders: policy.EnabledFolders ?? [],
    enablePublicSharing: policy.EnablePublicSharing ?? false,
    invalidLoginAttemptCount: policy.InvalidLoginAttemptCount ?? 0,
    loginAttemptsBeforeLockout: policy.LoginAttemptsBeforeLockout ?? 3,
    maxActiveSessions: policy.MaxActiveSessions ?? 0,
    remoteClientBitrateLimit: policy.RemoteClientBitrateLimit ?? 0,
    authenticationProviderId:
      policy.AuthenticationProviderId ??
      "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
    passwordResetProviderId:
      policy.PasswordResetProviderId ??
      "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
    syncPlayAccess: policy.SyncPlayAccess ?? "CreateAndJoinGroups",
    updatedAt: new Date(),
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
