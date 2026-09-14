import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./connection";
import {
  servers,
  userGroupAudit,
  userGroupMembers,
  userGroups,
  users,
  type UserGroupSnapshot,
} from "./schema";
import {
  getUserGroupAccounts,
  getUserGroups,
  UserGroupError,
} from "./user-groups";

export type UserGroupsBackup = {
  accounts: { id: string; name: string }[];
  groups: { primaryUserId: string; memberUserIds: string[] }[];
};

export async function exportUserGroups({
  serverId,
  database = db,
}: {
  serverId: number;
  database?: typeof db;
}): Promise<UserGroupsBackup> {
  return database.transaction(async (tx) => {
    await tx
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, serverId))
      .for("share");
    const [groups, accounts] = await Promise.all([
      getUserGroups({ serverId, database: tx }),
      getUserGroupAccounts({ serverId, database: tx }),
    ]);
    const memberIds = new Set(groups.flatMap((g) => g.memberUserIds));
    return {
      accounts: accounts
        .filter((a) => memberIds.has(a.id))
        .map((a) => ({ id: a.id, name: a.name })),
      groups: groups.map((g) => ({
        primaryUserId: g.primaryUserId,
        memberUserIds: g.memberUserIds,
      })),
    };
  });
}

export async function restoreUserGroups({
  serverId,
  backup,
  actor,
  database = db,
}: {
  serverId: number;
  backup: UserGroupsBackup;
  actor: { id: string; name: string };
  database?: typeof db;
}): Promise<void> {
  await database.transaction(async (tx) => {
    const locked = await tx
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, serverId))
      .for("update");
    if (!locked.length) throw new UserGroupError("Server not found.", 404);
    const memberIds = backup.groups.flatMap((g) => g.memberUserIds);
    if (
      new Set(memberIds).size !== memberIds.length ||
      new Set(backup.accounts.map((a) => a.id)).size !== backup.accounts.length
    )
      throw new UserGroupError("Backup contains duplicate memberships.");
    const names = new Map(backup.accounts.map((a) => [a.id, a.name]));
    if (
      memberIds.some((id) => !names.has(id)) ||
      backup.accounts.some((a) => !memberIds.includes(a.id))
    )
      throw new UserGroupError(
        "Backup member identities do not match its groups.",
      );
    for (const group of backup.groups) {
      if (
        group.memberUserIds.length < 2 ||
        !group.memberUserIds.includes(group.primaryUserId)
      )
        throw new UserGroupError("Invalid group in backup.");
    }
    if (!memberIds.length) return;
    const accounts = await tx
      .select({ id: users.id, serverId: users.serverId })
      .from(users)
      .where(inArray(users.id, memberIds));
    if (accounts.some((a) => a.serverId !== serverId))
      throw new UserGroupError(
        "An account ID already belongs to another server. Explicit account mapping is required.",
        409,
      );
    const existing = await getUserGroups({ serverId, database: tx });
    const pending = backup.groups.filter((group) => {
      const overlap = existing.filter((g) =>
        g.memberUserIds.some((id) => group.memberUserIds.includes(id)),
      );
      if (!overlap.length) return true;
      const same =
        overlap.length === 1 &&
        overlap[0]?.primaryUserId === group.primaryUserId &&
        [...group.memberUserIds].sort().join("\0") ===
          overlap[0].memberUserIds.join("\0");
      if (!same)
        throw new UserGroupError(
          "Backup conflicts with existing merged accounts. Unlink or explicitly map those accounts before restoring.",
          409,
        );
      return false;
    });
    const known = new Set(accounts.map((a) => a.id));
    const historical = backup.accounts.filter((a) => !known.has(a.id));
    if (historical.length)
      await tx.insert(users).values(
        historical.map((a) => ({
          id: a.id,
          name: a.name,
          serverId,
          isDisabled: true,
          isAdministrator: false,
          enableAllFolders: false,
          enabledFolders: [],
          enableMediaPlayback: false,
          enableUserPreferenceAccess: false,
        })),
      );
    for (const group of pending) {
      const id = randomUUID();
      const after: UserGroupSnapshot = {
        ...group,
        memberUserIds: [...group.memberUserIds].sort(),
        serverId,
        id,
        revision: 1,
      };
      await tx
        .insert(userGroups)
        .values({ id, serverId, primaryUserId: group.primaryUserId });
      await tx
        .insert(userGroupMembers)
        .values(
          group.memberUserIds.map((userId) => ({
            serverId,
            groupId: id,
            userId,
          })),
        );
      await tx.insert(userGroupAudit).values({
        serverId,
        operationId: randomUUID(),
        actorId: actor.id,
        actorName: actor.name,
        requestHash: createHash("sha256")
          .update(JSON.stringify({ restore: after }))
          .digest("hex"),
        before: null,
        after,
      });
    }
  });
}
