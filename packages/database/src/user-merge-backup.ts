import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./connection";
import {
  hiddenRecommendations,
  sessions,
  userMergeAudit,
  userMerges,
  users,
} from "./schema";
import {
  mergeUsersPermanently,
  previewUserMerge,
  runUserMergeTransaction,
  UserMergeError,
} from "./user-merge";

export type UserMergeBackup = {
  retiredUsers: {
    sourceUserId: string;
    sourceName: string;
    targetUserId: string;
  }[];
  accounts: { id: string; name: string }[];
};

export async function exportMergedUserData({
  serverId,
  database = db,
}: {
  serverId: number;
  database?: typeof db;
}) {
  return database.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock_shared(582, ${serverId})`,
    );
    const retiredUsers = await tx
      .select({
        sourceUserId: userMerges.sourceUserId,
        sourceName: userMerges.sourceName,
        targetUserId: userMerges.targetUserId,
      })
      .from(userMerges)
      .where(eq(userMerges.serverId, serverId));
    const targetIds = [...new Set(retiredUsers.map((row) => row.targetUserId))];
    const accounts = targetIds.length
      ? await tx
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(
            and(eq(users.serverId, serverId), inArray(users.id, targetIds)),
          )
      : [];
    return {
      sessions: await tx
        .select()
        .from(sessions)
        .where(eq(sessions.serverId, serverId)),
      hiddenRecommendations: await tx
        .select()
        .from(hiddenRecommendations)
        .where(eq(hiddenRecommendations.serverId, serverId)),
      userMerges: { retiredUsers, accounts },
    };
  });
}

export async function restoreUserMerges({
  serverId,
  backup,
  actor,
  database = db,
}: {
  serverId: number;
  backup: UserMergeBackup;
  actor: { id: string; name: string };
  database?: typeof db;
}) {
  await runUserMergeTransaction({
    serverId,
    database,
    run: async (tx) => {
      const sourceIds = backup.retiredUsers.map((row) => row.sourceUserId);
      const targetIds = [
        ...new Set(backup.retiredUsers.map((row) => row.targetUserId)),
      ];
      if (
        new Set(sourceIds).size !== sourceIds.length ||
        targetIds.some((id) => sourceIds.includes(id)) ||
        new Set(backup.accounts.map((a) => a.id)).size !==
          backup.accounts.length ||
        backup.accounts.length !== targetIds.length ||
        targetIds.some((id) => !backup.accounts.some((a) => a.id === id))
      )
        throw new UserMergeError("Invalid permanent merge metadata.");
      if (!sourceIds.length) return;
      const existing = await tx
        .select()
        .from(users)
        .where(inArray(users.id, [...sourceIds, ...targetIds]));
      if (existing.some((a) => a.serverId !== serverId))
        throw new UserMergeError(
          "An account belongs to another server. Explicit account mapping is required.",
          409,
        );
      const aliases = await tx
        .select()
        .from(userMerges)
        .where(eq(userMerges.serverId, serverId));
      if (
        targetIds.some((id) => aliases.some((a) => a.sourceUserId === id)) ||
        backup.retiredUsers.some((row) =>
          aliases.some(
            (a) =>
              a.sourceUserId === row.sourceUserId &&
              a.targetUserId !== row.targetUserId,
          ),
        )
      )
        throw new UserMergeError(
          "Backup conflicts with existing permanent merges.",
          409,
        );
      for (const account of backup.accounts) {
        if (!existing.some((a) => a.id === account.id))
          await tx.insert(users).values({
            ...account,
            serverId,
            isDisabled: true,
            isAdministrator: false,
            enableAllFolders: false,
            enabledFolders: [],
            enableMediaPlayback: false,
            enableUserPreferenceAccess: false,
          });
      }
      for (const row of backup.retiredUsers) {
        if (aliases.some((a) => a.sourceUserId === row.sourceUserId)) continue;
        if (existing.some((a) => a.id === row.sourceUserId)) {
          const preview = await previewUserMerge({
            serverId,
            input: row,
            database: tx,
          });
          await mergeUsersPermanently({
            serverId,
            input: row,
            previewToken: preview.token,
            operationId: randomUUID(),
            actor,
            database: tx,
          });
        } else {
          const target = backup.accounts.find((a) => a.id === row.targetUserId);
          if (!target)
            throw new UserMergeError("Missing destination account metadata.");
          await tx.insert(userMerges).values({ ...row, serverId });
          await tx.insert(userMergeAudit).values({
            serverId,
            ...row,
            targetName: target.name,
            actorId: actor.id,
            actorName: actor.name,
            operationId: randomUUID(),
            requestHash: createHash("sha256")
              .update(JSON.stringify(row))
              .digest("hex"),
            transferred: {},
          });
        }
      }
    },
  });
}
