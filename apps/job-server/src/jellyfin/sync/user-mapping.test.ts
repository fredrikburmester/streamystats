import { describe, expect, test } from "bun:test";
import type { JellyfinUser } from "../client";
import { mapJellyfinUser } from "./user-mapping";

// Shape of GET /Users on Jellyfin 10.11 and 12.0: flags only under Policy.
const adminFromJellyfin: JellyfinUser = {
  Id: "96e4b809320a43139612f5eabebd1048",
  Name: "admin",
  ServerId: "f245f85a5f484ebcb54c9a7f06859017",
  HasPassword: true,
  HasConfiguredPassword: true,
  HasConfiguredEasyPassword: false,
  EnableAutoLogin: false,
  LastLoginDate: "2026-09-12T06:53:58.0951948Z",
  LastActivityDate: "2026-09-12T06:53:58.0951948Z",
  Policy: {
    IsAdministrator: true,
    IsHidden: false,
    IsDisabled: false,
    EnableAllFolders: false,
    EnabledFolders: ["f137a2dd21bbc1b99aa5c0f6bf02a805"],
    EnableRemoteAccess: true,
    InvalidLoginAttemptCount: 2,
    LoginAttemptsBeforeLockout: 5,
    MaxActiveSessions: 3,
    RemoteClientBitrateLimit: 8000000,
    AuthenticationProviderId: "Jellyfin.Server.Implementations.Users.DefaultAuthenticationProvider",
    PasswordResetProviderId: "Jellyfin.Server.Implementations.Users.DefaultPasswordResetProvider",
    SyncPlayAccess: "None",
  },
};

describe("mapJellyfinUser", () => {
  test("reads permission flags from Policy, not the top level", () => {
    const row = mapJellyfinUser(adminFromJellyfin, 1);

    expect(row.isAdministrator).toBe(true);
    expect(row.isDisabled).toBe(false);
    expect(row.enableAllFolders).toBe(false);
    expect(row.enabledFolders).toEqual(["f137a2dd21bbc1b99aa5c0f6bf02a805"]);
    expect(row.invalidLoginAttemptCount).toBe(2);
    expect(row.loginAttemptsBeforeLockout).toBe(5);
    expect(row.maxActiveSessions).toBe(3);
    expect(row.remoteClientBitrateLimit).toBe(8000000);
    expect(row.syncPlayAccess).toBe("None");
    expect(row.lastLoginDate?.toISOString()).toBe("2026-09-12T06:53:58.095Z");
  });

  test("flags a disabled non-admin user", () => {
    const row = mapJellyfinUser(
      {
        ...adminFromJellyfin,
        Id: "a0173cca554a49faaab273f76399dbc7",
        Name: "carol",
        Policy: { IsAdministrator: false, IsDisabled: true },
      },
      1,
    );

    expect(row.isAdministrator).toBe(false);
    expect(row.isDisabled).toBe(true);
  });

  test("falls back to the table defaults when Policy is missing", () => {
    const row = mapJellyfinUser({ Id: "u1", Name: "minimal" }, 7);

    expect(row.serverId).toBe(7);
    expect(row.isAdministrator).toBe(false);
    expect(row.enableAllFolders).toBe(true);
    expect(row.enabledFolders).toEqual([]);
    expect(row.loginAttemptsBeforeLockout).toBe(3);
    expect(row.syncPlayAccess).toBe("CreateAndJoinGroups");
    expect(row.lastLoginDate).toBeNull();
  });

  test("derives hasPassword from HasConfiguredPassword once HasPassword is gone", () => {
    const row = mapJellyfinUser(
      { Id: "u2", Name: "twelve", HasConfiguredPassword: true },
      1,
    );

    expect(row.hasPassword).toBe(true);
    expect(row.hasConfiguredPassword).toBe(true);
  });
});
